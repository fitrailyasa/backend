class ApplicationController < ActionController::API
  include Respondable

  rescue_from StandardError, with: :render_internal_error
  rescue_from ActiveRecord::DeleteRestrictionError, with: :render_conflict_reference
  rescue_from ActiveRecord::InvalidForeignKey, with: :render_conflict_reference
  rescue_from ActiveRecord::RecordNotUnique, with: :render_unique_conflict
  rescue_from ActiveRecord::RecordInvalid, with: :render_record_invalid
  rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
  rescue_from ActionDispatch::Http::Parameters::ParseError, with: :render_bad_json
  rescue_from ApiError, with: :render_api_error

  def route_not_found
    render_error("Resource not found", status: 404)
  end

  private

  def render_api_error(error)
    render_error(error.message, status: error.status, errors: error.errors)
  end

  def render_not_found(_error)
    render_error("Resource not found", status: 404)
  end

  def render_bad_json(_error)
    render_error("Invalid JSON payload", status: 400)
  end

  def render_record_invalid(error)
    errors = error.record.errors.to_hash.transform_keys(&:to_s)
    errors = errors.transform_values { |messages| Array(messages).map(&:to_s) }
    render_error("Validation failed", status: 422, errors: errors)
  end

  def render_conflict_reference(_error)
    render_error("Resource is still referenced by other records", status: 409)
  end

  def render_unique_conflict(error)
    message = error.message.to_s.downcase.include?("slug") ? "The slug has already been taken" : "Resource already exists"
    render_error(message, status: 409)
  end

  def render_internal_error(error)
    Rails.logger.error("[500] #{request.method} #{request.fullpath} #{error.class}: #{error.message}\n#{Array(error.backtrace).first(20).join("\n")}")
    warn("[500] #{error.class}: #{error.message}\n#{Array(error.backtrace).first(12).join("\n")}") if Rails.env.test?
    render_error("Internal server error", status: 500)
  end
end
