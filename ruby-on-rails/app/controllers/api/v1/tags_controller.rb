module Api
  module V1
    class TagsController < BaseController
      before_action :require_admin!, only: %i[create update destroy]

      def index
        paging = pagination_params!(%w[id name slug created_at updated_at])
        includes = include_params!("products")
        scope = apply_search(Tag.all, %w[name], paging[:search])
        rows, meta = paginate(scope, paging: paging, sortable: %w[id name slug created_at updated_at], preload: includes.include?("products") ? [:products] : nil)
        render_success("Tags retrieved", rows.map { |tag| ApiSerializer.tag(tag, includes: includes) }, meta: meta)
      end

      def show
        render_success("Tag retrieved", ApiSerializer.tag(find_record!(Tag, :id, "Tag")))
      end

      def create
        body = json_body
        errors = blank_errors
        name = string_field(errors, body, "name", label: "Name", required: true, min: 2, max: 60)
        slug = optional_slug(errors, body, max: 80)
        finish_validation!(errors)

        tag = Tag.new(name: name)
        write_slug!(tag, name: name, slug_input: slug.is_a?(String) ? slug : nil, limit: 80, fallback_to_name: true)
        tag.save!
        render_created("Tag created successfully", ApiSerializer.tag(tag))
      end

      def update
        tag = find_record!(Tag, :id, "Tag")
        body = json_body
        errors = blank_errors
        name = string_field(errors, body, "name", label: "Name", required: request.put?, min: 2, max: 60)
        slug = optional_slug(errors, body, max: 80)
        finish_validation!(errors)

        tag.name = name if name.present? && (request.put? || body.key?("name"))
        if slug.is_a?(String)
          write_slug!(tag, name: tag.name, slug_input: slug, limit: 80, fallback_to_name: false)
        end
        tag.save!
        render_success("Tag updated successfully", ApiSerializer.tag(tag))
      end

      def destroy
        find_record!(Tag, :id, "Tag").destroy!
        render_success("Tag deleted successfully", nil)
      end
    end
  end
end
