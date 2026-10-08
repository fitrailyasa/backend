module Mysql2
  class Client
    FOUND_ROWS = 1 << 1
    MULTI_STATEMENTS = 1 << 16
    OPTION_MULTI_STATEMENTS_ON = 0
    OPTION_MULTI_STATEMENTS_OFF = 1

    attr_reader :query_options

    def initialize(config = {})
      @query_options = { as: :array, async: false, cast_booleans: false, symbolize_keys: false, database_timezone: :local, application_timezone: nil, cache_rows: true, connect_flags: FOUND_ROWS, cast: false }
      @mysql = ::Mysql.connect(
        host: config[:host] || "127.0.0.1",
        username: config[:username],
        password: config[:password].to_s,
        database: config[:database],
        port: (config[:port] || 3306).to_i,
        charset: charset_name(config[:encoding]),
        cast: false,
        ssl_mode: "disabled",
        get_server_public_key: true
      )
    rescue ::Mysql::Error => error
      raise wrap(error)
    end

    def query(sql, _options = nil)
      result = @mysql.query(sql, cast: false)
      result ? Result.new(result) : nil
    rescue ::Mysql::Error => error
      raise wrap(error)
    end

    def ping
      @mysql.ping
      true
    rescue ::Mysql::Error
      false
    end

    def close
      @mysql&.close
      @mysql = nil
    end

    def closed?
      @mysql.nil?
    end

    def abandon_results!
      nil
    end

    def escape(value)
      ::Mysql.escape_string(value.to_s)
    end

    def warning_count
      0
    end

    def affected_rows
      @mysql&.affected_rows.to_i
    end

    def last_id
      @mysql&.insert_id.to_i
    end

    def server_info
      { version: @mysql.server_info.to_s }
    end

    def automatic_close=(_value)
      nil
    end

    def set_server_option(_option)
      nil
    end

    def prepare(_sql)
      raise Error, "prepared statements are not available in the pure Ruby client"
    end

    private

    def charset_name(encoding)
      name = encoding.to_s
      name.empty? ? "utf8mb4" : name
    end

    def wrap(error)
      number = error.respond_to?(:errno) ? error.errno : nil
      Error.new(error.message, number)
    end
  end
end
