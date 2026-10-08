module Api
  module V1
    class CategoriesController < BaseController
      before_action :require_admin!, only: %i[create update destroy]

      def index
        paging = pagination_params!
        includes = include_params!("products")
        scope = apply_search(Category.all, %w[name description], paging[:search])
        rows, meta = paginate(scope, paging: paging, sortable: %w[id name slug created_at updated_at], preload: includes.include?("products") ? [:products] : nil)
        render_success("Categories retrieved", rows.map { |category| ApiSerializer.category(category, includes: includes) }, meta: meta)
      end

      def show
        includes = include_params!("products")
        category = find_record!(Category, :id, "Category")
        category.products.load if includes.include?("products")
        render_success("Category retrieved", ApiSerializer.category(category, includes: includes))
      end

      def create
        body = json_body
        errors = blank_errors
        name = string_field(errors, body, "name", label: "Name", required: true, min: 2, max: 100)
        slug = optional_slug(errors, body, max: 120)
        description = nullable_text(errors, body, "description", label: "Description")
        finish_validation!(errors)

        category = Category.new(name: name, description: description == :absent ? nil : description)
        write_slug!(category, name: name, slug_input: slug.is_a?(String) ? slug : nil, limit: 120, fallback_to_name: true)
        category.save!
        render_created("Category created successfully", ApiSerializer.category(category))
      end

      def update
        category = find_record!(Category, :id, "Category")
        body = json_body
        errors = blank_errors
        name = string_field(errors, body, "name", label: "Name", required: request.put?, min: 2, max: 100)
        slug = optional_slug(errors, body, max: 120)
        description = nullable_text(errors, body, "description", label: "Description")
        finish_validation!(errors)

        category.name = name if name.present? && (request.put? || body.key?("name"))
        category.description = description unless description == :absent || description == :invalid
        if slug.is_a?(String)
          write_slug!(category, name: category.name, slug_input: slug, limit: 120, fallback_to_name: false)
        end
        category.save!
        includes = include_params!("products")
        category.products.load if includes.include?("products")
        render_success("Category updated successfully", ApiSerializer.category(category, includes: includes))
      end

      def destroy
        find_record!(Category, :id, "Category").destroy!
        render_success("Category deleted successfully", nil)
      end
    end
  end
end
