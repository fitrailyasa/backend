require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = false
  config.consider_all_requests_local = true
  config.action_dispatch.show_exceptions = :none
  config.action_controller.allow_forgery_protection = false
  config.action_controller.perform_caching = false
  config.cache_store = :memory_store
  config.active_support.deprecation = :stderr
  config.active_support.disallowed_deprecation = :raise
  config.active_support.disallowed_deprecation_warnings = []
  config.active_record.migration_error = false
  config.active_record.maintain_test_schema = true
  config.hosts.clear
end
