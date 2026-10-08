class HealthController < ApplicationController
  def show
    render json: {
      status: "ok",
      uptime: ProcessUptime.seconds,
      timestamp: Time.now.utc.iso8601(3)
    }
  end
end
