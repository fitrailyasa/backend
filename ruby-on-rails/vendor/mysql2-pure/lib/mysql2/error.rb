module Mysql2
  class Error < StandardError
    attr_reader :error_number

    def initialize(message = nil, error_number = nil)
      @error_number = error_number
      super(message)
    end

    class TimeoutError < Error; end
    class ConnectionError < Error; end
  end
end
