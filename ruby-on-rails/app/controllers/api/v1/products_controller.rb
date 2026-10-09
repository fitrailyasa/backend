module Api
  module V1
    class ProductsController < BaseController
      before_action :require_admin!, only: %i[create update destroy]

      SORTABLE = %w[id name slug price stock category_id created_at updated_at].freeze

      def index
        paging = pagination_params!(SORTABLE)
        includes = include_params!("category", "tags")
        validate_product_filters!
        scope = Product.all
        scope = scope.where(category_id: params[:category_id]) if params[:category_id].present?
        scope = scope.where("products.price >= ?", params[:min_price]) if params[:min_price].present?
        scope = scope.where("products.price <= ?", params[:max_price]) if params[:max_price].present?
        if params[:tag_id].present? || params[:tag].present?
          scope = scope.joins(:tags)
          scope = scope.where(tags: { id: params[:tag_id] }) if params[:tag_id].present?
          scope = scope.where(tags: { slug: Slugify.call(params[:tag], max: 80) }) if params[:tag].present?
          includes |= ["tags"]
        end
        scope = apply_search(scope, %w[name description], paging[:search])
        preload = []
        preload << :category if includes.include?("category")
        preload << :tags if includes.include?("tags")
        rows, meta = paginate(scope, paging: paging, sortable: SORTABLE, preload: preload.presence)
        render_success("Products retrieved", rows.map { |product| ApiSerializer.product(product, includes: includes) }, meta: meta)
      end

      def show
        includes = include_params!("category", "tags")
        validate_product_filters!
        product = find_record!(Product, :id, "Product")
        if params[:tag_id].present? || params[:tag].present?
          matched = product.tags.any? do |tag|
            (params[:tag_id].blank? || tag.id == params[:tag_id].to_i) &&
              (params[:tag].blank? || tag.slug == Slugify.call(params[:tag], max: 80))
          end
          raise ApiError.new("Product not found", status: 404) unless matched
          includes |= ["tags"]
        end
        render_success("Product retrieved", ApiSerializer.product(product, includes: includes))
      end

      def create
        body = json_body
        errors = blank_errors
        attrs = product_attrs(errors, body, required: true)
        finish_validation!(errors)
        assert_category!(attrs[:category_id])
        assert_tags!(attrs[:tag_ids])

        product = Product.new(
          category_id: attrs[:category_id],
          name: attrs[:name],
          description: attrs[:description],
          price: attrs[:price],
          stock: attrs[:stock].nil? ? 0 : attrs[:stock]
        )
        write_slug!(product, name: attrs[:name], slug_input: attrs[:slug], limit: 180, fallback_to_name: true)
        product.save!
        product.tag_ids = attrs[:tag_ids] if attrs[:tag_ids]
        render_created("Product created successfully", ApiSerializer.product(product.reload))
      end

      def update
        product = find_record!(Product, :id, "Product")
        body = json_body
        errors = blank_errors
        attrs = product_attrs(errors, body, required: request.put?)
        finish_validation!(errors)
        assert_category!(attrs[:category_id]) if attrs[:category_id]
        assert_tags!(attrs[:tag_ids]) if attrs.key?(:tag_ids) && attrs[:tag_ids]

        product.category_id = attrs[:category_id] if attrs[:category_id]
        product.name = attrs[:name] if attrs[:name]
        product.description = attrs[:description] if attrs.key?(:description)
        product.price = attrs[:price] if attrs[:price]
        product.stock = attrs[:stock] if attrs.key?(:stock) && !attrs[:stock].nil?
        if attrs[:slug].is_a?(String)
          write_slug!(product, name: product.name, slug_input: attrs[:slug], limit: 180, fallback_to_name: false)
        end
        product.save!
        product.tag_ids = attrs[:tag_ids] if attrs.key?(:tag_ids) && attrs[:tag_ids]
        render_success("Product updated successfully", ApiSerializer.product(product.reload))
      end

      def destroy
        find_record!(Product, :id, "Product").destroy!
        render_success("Product deleted successfully", nil)
      end

      private

      def validate_product_filters!
        errors = blank_errors
        if params[:category_id].present? && params[:category_id].to_s !~ /\A[1-9]\d*\z/
          errors["category_id"] << "category_id must be a positive integer."
        end
        if params[:tag_id].present? && params[:tag_id].to_s !~ /\A[1-9]\d*\z/
          errors["tag_id"] << "tag_id must be a positive integer."
        end
        if params[:tag].present? && !params[:tag].is_a?(String)
          errors["tag"] << "tag must be a string."
        end
        %w[min_price max_price].each do |key|
          next if params[key].blank?
          unless coerce_decimal(params[key])
            errors[key] << "#{key} must be a number greater than or equal to 0."
          end
        end
        finish_validation!(errors)
      end

      def product_attrs(errors, body, required:)
        name = string_field(errors, body, "name", label: "Name", required: required, min: 2, max: 150)
        category_id = positive_id_field(errors, body, "category_id", required: required, message: "category_id must be a positive integer.")
        price = decimal_field(errors, body, "price", label: "Price", required: required)
        slug = optional_slug(errors, body, max: 180)
        description = nullable_text(errors, body, "description", label: "Description")
        stock = integer_field(
          errors, body, "stock",
          label: "Stock",
          required: false,
          min: 0,
          message: "Stock must be an integer greater than or equal to 0."
        )
        tag_ids = tag_ids_field(errors, body)
        attrs = { name: name, category_id: category_id, price: price, slug: slug.is_a?(String) ? slug : nil, stock: stock }
        attrs[:description] = description unless description == :absent || description == :invalid
        attrs[:tag_ids] = tag_ids if tag_ids
        attrs
      end

      def tag_ids_field(errors, body)
        return nil unless body.key?("tags")

        tags = body["tags"]
        unless tags.is_a?(Array) && tags.length.between?(1, 20)
          errors["tags"] << "tags must be an array of tag ids."
          return nil
        end
        ids = tags.map { |entry| coerce_integer(entry) }
        unless ids.all? { |entry| entry.is_a?(Integer) && entry.positive? }
          errors["tags"] << "tags must be an array of positive integers."
          return nil
        end
        ids.uniq
      end

      def assert_category!(category_id)
        return if category_id.blank?
        return if Category.exists?(category_id)

        raise ApiError.new("Validation failed", status: 422, errors: { "category_id" => ["The selected category id is invalid."] })
      end

      def assert_tags!(tag_ids)
        return if tag_ids.blank?
        return if Tag.where(id: tag_ids).count == tag_ids.length

        raise ApiError.new("Validation failed", status: 422, errors: { "tags" => ["One or more selected tags are invalid."] })
      end
    end
  end
end
