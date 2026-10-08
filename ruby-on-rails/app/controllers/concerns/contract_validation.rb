module ContractValidation
  EMAIL_RE = /\A[^@\s]+@[^@\s]+\.[^@\s]+\z/
  SLUG_RE = /\A[a-z0-9]+(?:-[a-z0-9]+)*\z/

  def blank_errors
    Hash.new { |hash, key| hash[key] = [] }
  end

  def finish_validation!(errors)
    compacted = {}
    errors.each do |key, messages|
      next if messages.blank?

      compacted[key.to_s] = Array(messages)
    end
    return if compacted.empty?

    raise ApiError.new("Validation failed", status: 422, errors: compacted)
  end

  def string_field(errors, body, key, label:, required:, min:, max:)
    missing = !body.key?(key) || body[key].nil? || (body[key].is_a?(String) && body[key].strip.empty?)
    if missing
      errors[key] << "#{label} is required." if required
      return nil
    end
    unless body[key].is_a?(String)
      errors[key] << "#{label} must be a string."
      return nil
    end

    value = body[key].strip
    if value.length < min || value.length > max
      errors[key] << "#{label} must be between #{min} and #{max} characters."
    end
    value
  end

  def optional_slug(errors, body, max:)
    return :absent unless body.key?("slug")
    return :blank if body["slug"].nil? || (body["slug"].is_a?(String) && body["slug"].strip.empty?)
    unless body["slug"].is_a?(String)
      errors["slug"] << "Slug must be a string."
      return :invalid
    end

    value = body["slug"].strip
    if value.length < 1 || value.length > max
      errors["slug"] << "Slug must be between 1 and #{max} characters."
    elsif value !~ SLUG_RE
      errors["slug"] << "Slug may only contain lowercase letters, numbers and single hyphens."
    end
    value
  end

  def nullable_text(errors, body, key, label:)
    return :absent unless body.key?(key)
    return nil if body[key].nil?
    unless body[key].is_a?(String)
      errors[key] << "#{label} must be a string."
      return :invalid
    end

    stripped = body[key].strip
    stripped.empty? ? nil : stripped
  end

  def email_field(errors, body, required:)
    missing = !body.key?("email") || body["email"].nil? || (body["email"].is_a?(String) && body["email"].strip.empty?)
    if missing
      errors["email"] << "Email is required." if required
      return nil
    end
    unless body["email"].is_a?(String)
      errors["email"] << "Email must be a string."
      return nil
    end

    value = body["email"].strip.downcase
    if value.length < 3 || value.length > 150
      errors["email"] << "Email must be between 3 and 150 characters."
    elsif value !~ EMAIL_RE
      errors["email"] << "The email must be a valid email address."
    end
    value
  end

  def password_field(errors, body, required:, confirm:)
    missing = !body.key?("password") || body["password"].nil? || body["password"] == ""
    if missing
      errors["password"] << "Password is required." if required
      return nil
    end
    unless body["password"].is_a?(String)
      errors["password"] << "Password must be a string."
      return nil
    end

    value = body["password"]
    if value.length < 8 || value.length > 72
      errors["password"] << "Password must be at least 8 characters long."
    end

    if confirm
      confirmation = body["password_confirmation"]
      if confirmation.nil? || confirmation == ""
        errors["password_confirmation"] << "password_confirmation is required."
      elsif !confirmation.is_a?(String) || confirmation != value
        errors["password_confirmation"] << "password_confirmation must match password."
      end
    elsif body.key?("password_confirmation") && body["password_confirmation"].present?
      confirmation = body["password_confirmation"]
      if confirmation != value
        errors["password_confirmation"] << "password_confirmation must match password."
      end
    end
    value
  end

  def decimal_field(errors, body, key, label:, required:)
    if !body.key?(key) || body[key].nil? || body[key] == ""
      errors[key] << "#{label} is required." if required
      return nil
    end

    decimal = coerce_decimal(body[key])
    if decimal.nil? || decimal.negative?
      errors[key] << "#{label} must be a number greater than or equal to 0."
      return nil
    end
    decimal
  end

  def integer_field(errors, body, key, label:, required:, min:, message:)
    if !body.key?(key) || body[key].nil? || body[key] == ""
      errors[key] << "#{label} is required." if required
      return nil
    end

    value = coerce_integer(body[key])
    if value.nil? || value < min
      errors[key] << message
      return nil
    end
    value
  end

  def positive_id_field(errors, body, key, required:, message:)
    if !body.key?(key) || body[key].nil? || body[key] == ""
      errors[key] << "#{key} is required." if required
      return nil
    end

    value = coerce_integer(body[key])
    if value.nil? || value < 1
      errors[key] << message
      return nil
    end
    value
  end

  def email_taken?(email, except_id: nil)
    scope = User.where("LOWER(email) = ?", email.to_s.downcase)
    scope = scope.where.not(id: except_id) if except_id
    scope.exists?
  end

  def write_slug!(record, name:, slug_input:, limit:, fallback_to_name:)
    source = if slug_input.is_a?(String) && slug_input.strip != ""
               slug_input
             elsif fallback_to_name
               name
             else
               slug_input.to_s
             end
    record.slug = Slugify.call(source, max: limit)
    if record.slug.blank?
      raise ApiError.new("Validation failed", status: 422, errors: { "slug" => ["Slug is invalid."] })
    end

    scope = record.class.where(slug: record.slug)
    scope = scope.where.not(id: record.id) if record.persisted?
    return unless scope.exists?

    raise ApiError.new(%(Slug "#{record.slug}" has already been taken), status: 409)
  end

  def coerce_decimal(value)
    case value
    when Integer, Float, BigDecimal
      BigDecimal(value.to_s)
    when String
      return nil unless value.match?(/\A\d+(\.\d+)?\z/)

      BigDecimal(value)
    end
  end

  def coerce_integer(value)
    case value
    when Integer
      value
    when String
      return nil unless value.match?(/\A-?\d+\z/)

      value.to_i
    end
  end
end
