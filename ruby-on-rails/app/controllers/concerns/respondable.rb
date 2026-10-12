module Respondable
  def render_success(message, data = nil, status: 200, meta: nil)
    body = { success: true, message: message, data: data }
    body[:meta] = meta if meta
    render json: body, status: status
  end

  def render_created(message, data = nil)
    render_success(message, data, status: 201)
  end

  def render_error(message, status:, errors: nil, headers: nil)
    code = status.is_a?(Integer) ? status : Rack::Utils.status_code(status)
    body = { success: false, message: message }
    body[:errors] = errors if code == 422 && errors.present?
    (headers || {}).each { |name, value| response.set_header(name, value) }
    render json: body, status: code
  end
end
