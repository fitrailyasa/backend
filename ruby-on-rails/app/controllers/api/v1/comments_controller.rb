module Api
  module V1
    class CommentsController < BaseController
      before_action :authenticate!, only: %i[create update destroy]

      SORTABLE = %w[id body product_id user_id created_at updated_at].freeze

      def index
        if nested_product_comments?
          index_for_product
        else
          index_all
        end
      end

      def create
        product_id = require_positive_int!("product_id")
        raise ApiError.new("Product with id #{product_id} not found", status: 404) unless Product.exists?(product_id)

        body = json_body
        errors = blank_errors
        text = string_field(errors, body, "body", label: "Body", required: true, min: 1, max: 2000)
        finish_validation!(errors)

        comment = Comment.create!(product_id: product_id, user_id: current_user.id, body: text)
        render_created("Comment created successfully", ApiSerializer.comment(comment))
      end

      def update
        comment = find_record!(Comment, :id, "Comment")
        authorize_owner!(comment)
        body = json_body
        errors = blank_errors
        text = string_field(errors, body, "body", label: "Body", required: true, min: 1, max: 2000)
        finish_validation!(errors)

        comment.update!(body: text)
        render_success("Comment updated successfully", ApiSerializer.comment(comment))
      end

      def destroy
        comment = find_record!(Comment, :id, "Comment")
        authorize_owner!(comment)
        comment.destroy!
        render_success("Comment deleted successfully", nil)
      end

      private

      def index_all
        paging = pagination_params!(SORTABLE)
        includes = include_params!("user", "product")
        validate_comment_filters!
        scope = Comment.all
        scope = scope.where(product_id: params[:product_id]) if params[:product_id].present?
        scope = scope.where(user_id: params[:user_id]) if params[:user_id].present?
        scope = apply_search(scope, %w[body], paging[:search])
        rows, meta = paginate(scope, paging: paging, sortable: SORTABLE, preload: preload_for(includes))
        render_success("Comments retrieved", rows.map { |comment| ApiSerializer.comment(comment, includes: includes) }, meta: meta)
      end

      def index_for_product
        product_id = require_positive_int!("product_id")
        raise ApiError.new("Product with id #{product_id} not found", status: 404) unless Product.exists?(product_id)

        paging = pagination_params!(SORTABLE)
        includes = include_params!("user", "product")
        scope = Comment.where(product_id: product_id)
        scope = apply_search(scope, %w[body], paging[:search])
        rows, meta = paginate(scope, paging: paging, sortable: SORTABLE, preload: preload_for(includes))
        render_success("Comments retrieved", rows.map { |comment| ApiSerializer.comment(comment, includes: includes) }, meta: meta)
      end

      def validate_comment_filters!
        errors = blank_errors
        if params[:product_id].present? && params[:product_id].to_s !~ /\A[1-9]\d*\z/
          errors["product_id"] << "product_id must be a positive integer."
        end
        if params[:user_id].present? && params[:user_id].to_s !~ /\A[1-9]\d*\z/
          errors["user_id"] << "user_id must be a positive integer."
        end
        finish_validation!(errors)
      end

      def nested_product_comments?
        request.path.match?(%r{/products/[^/]+/comments\z})
      end

      def authorize_owner!(comment)
        return if current_user.admin? || comment.user_id == current_user.id

        raise ApiError.new("This action is unauthorized", status: 403)
      end

      def preload_for(includes)
        list = []
        list << :user if includes.include?("user")
        list << :product if includes.include?("product")
        list.presence
      end
    end
  end
end
