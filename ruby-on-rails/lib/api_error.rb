class ApiError < StandardError
  attr_reader :status, :errors

  def initialize(message, status:, errors: nil)
    super(message)
    @status = status
    @errors = errors
  end
end
