module Middleware
  # Resolves the client IP the same way Rails does. The rate limiters sit
  # deeper in the stack than ActionDispatch::RemoteIp, so its (proxy aware)
  # result is already available in the env; fall back to the socket address.
  module ClientIp
    def self.from(env)
      remote_ip = env["action_dispatch.remote_ip"]
      return remote_ip.to_s if remote_ip

      env["REMOTE_ADDR"].to_s
    end
  end
end
