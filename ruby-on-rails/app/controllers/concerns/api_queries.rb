module ApiQueries
  def pagination_params!(sortable = nil)
    errors = blank_errors
    page = params[:page]
    limit = params[:limit]
    order = params[:order]
    search = params[:search]
    sort = params[:sort]

    if page.present? && page.to_s !~ /\A[1-9]\d*\z/
      errors["page"] << "Page must be a positive integer."
    end
    if limit.present? && (limit.to_s !~ /\A[1-9]\d*\z/ || limit.to_i > 100)
      errors["limit"] << "Limit must be an integer between 1 and 100."
    end
    if order.present? && !%w[asc desc].include?(order.to_s.downcase)
      errors["order"] << "Order must be either asc or desc."
    end
    if search.present?
      errors["search"] << "Search must be a string." unless search.is_a?(String)
      errors["search"] << "Search must be at most 150 characters." if search.to_s.length > 150
    end
    if sort.present? && !sort.is_a?(String)
      errors["sort"] << "Sort must be a string."
    elsif sortable && sort.present? && !sortable.include?(sort.to_s.strip)
      errors["sort"] << "Sort must be one of: #{sortable.join(', ')}."
    end
    finish_validation!(errors)

    {
      page: page.present? ? page.to_i : 1,
      limit: limit.present? ? limit.to_i : 10,
      order: order.present? ? order.to_s.downcase : "desc",
      sort: sort.to_s.strip,
      search: search.to_s.strip
    }
  end

  def include_params!(*allowed)
    raw = params[:include]
    return [] if raw.blank?
    unless raw.is_a?(String)
      finish_validation!("include" => ["Include must be a comma separated string."])
    end

    entries = raw.split(",").map(&:strip).reject(&:empty?)
    invalid = entries - allowed
    if invalid.any?
      finish_validation!(
        "include" => ["Unsupported include value(s): #{invalid.join(', ')}. Allowed: #{allowed.join(', ')}."]
      )
    end
    entries
  end

  def require_positive_int!(name, value = params[name])
    unless value.to_s.match?(/\A[1-9]\d*\z/)
      finish_validation!(name => ["#{name} must be a positive integer."])
    end
    value.to_i
  end

  def find_record!(model, param_name, label)
    id = require_positive_int!(param_name.to_s)
    record = model.find_by(id: id)
    raise ApiError.new("#{label} not found", status: 404) unless record

    record
  end

  def json_body
    raw = request.raw_post
    return {} if raw.blank?

    parsed = JSON.parse(raw)
    raise ApiError.new("Invalid JSON payload", status: 400) unless parsed.is_a?(Hash)

    parsed
  rescue JSON::ParserError
    raise ApiError.new("Invalid JSON payload", status: 400)
  end

  def apply_search(scope, columns, term)
    return scope if term.blank?

    like = "%#{ActiveRecord::Base.sanitize_sql_like(term)}%"
    table = scope.klass.table_name
    sql = columns.map { |column| "#{table}.#{column} LIKE :q" }.join(" OR ")
    scope.where(sql, q: like)
  end

  def paginate(scope, paging:, sortable:, preload: nil)
    CollectionQuery.new(scope, paging: paging, sortable: sortable).results(preload: preload)
  end
end
