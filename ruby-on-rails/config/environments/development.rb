require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.enable_reloading = true
  config.eager_load = false
  config.consider_all_requests_local = true
  config.server_timing = true
  config.hosts.clear

  config.cache_store = :memory_store
  config.action_controller.perform_caching = false

  config.active_record.migration_error = :page_load
  config.active_record.verbose_query_logs = true

  config.active_support.deprecation = :log
  config.active_support.disallowed_deprecation = :raise
  config.active_support.disallowed_deprecation_warnings = []
  config.log_level = ENV.fetch("RAILS_LOG_LEVEL", "debug")
end
