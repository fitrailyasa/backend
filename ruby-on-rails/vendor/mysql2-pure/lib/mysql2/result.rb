module Mysql2
  class Result
    def initialize(result)
      @fields = result.fields.map { |field| field.name.to_s }
      @rows = []
      while (row = result.fetch)
        @rows << row
      end
    end

    attr_reader :fields

    def to_a
      @rows
    end

    def size
      @rows.size
    end

    def each(as: :array, symbolize_keys: false)
      return enum_for(:each, as: as, symbolize_keys: symbolize_keys) unless block_given?

      if as == :hash
        @rows.each do |row|
          record = {}
          @fields.each_with_index do |name, index|
            record[symbolize_keys ? name.to_sym : name] = row[index]
          end
          yield record
        end
      else
        @rows.each { |row| yield row }
      end
      self
    end

    def free
      nil
    end
  end
end
