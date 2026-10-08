module ProcessUptime
  STARTED_AT = Process.clock_gettime(Process::CLOCK_MONOTONIC)

  def self.seconds
    (Process.clock_gettime(Process::CLOCK_MONOTONIC) - STARTED_AT).round(6)
  end
end
