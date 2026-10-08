module Middleware
  class JsonParseErrors
    def initialize(app)
      @app = app
    end

    def call(env)
      @app.call(env)
    rescue ActionDispatch::Http::Parameters::ParseError
      body = { success: false, message: "Invalid JSON payload" }.to_json
      [400, { "content-type" => "application/json" }, [body]]
    end
  end
end
