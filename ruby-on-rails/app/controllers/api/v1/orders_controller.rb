module Api
  module V1
    class OrdersController < BaseController
      before_action :authenticate!
      before_action :require_admin!, only: :destroy

      SORTABLE = %w[id status total user_id created_at updated_at].freeze
      INCLUDES = %w[items items.product user].freeze

      def index
        paging = pagination_params!(SORTABLE)
        includes = include_params!(*INCLUDES)
        validate_filters!
        if params[:user_id].present? && !current_user.admin?
          raise ApiError.new("The user_id filter is only available to administrators", status: 403)
        end

        scope = Order.all
        scope = current_user.admin? ? scope : scope.where(user_id: current_user.id)
        scope = scope.where(user_id: params[:user_id]) if current_user.admin? && params[:user_id].present?
        scope = scope.where(status: params[:status]) if params[:status].present?
        rows, meta = paginate(scope, paging: paging, sortable: SORTABLE, preload: preload_for(includes))
        render_success("Orders retrieved", rows.map { |order| ApiSerializer.order(order, includes: includes) }, meta: meta)
      end

      def show
        includes = include_params!(*INCLUDES)
        id = require_positive_int!("id")
        scope = Order.all
        preload = preload_for(includes)
        scope = scope.preload(*preload) if preload
        order = scope.find_by(id: id)
        raise ApiError.new("Order not found", status: 404) unless order

        authorize_owner!(order)
        render_success("Order retrieved", ApiSerializer.order(order, includes: includes))
      end

      def create
        items = validate_items!(json_body)
        order = OrderCheckout.create(user: current_user, items: items)
        render_created(
          "Order created successfully",
          ApiSerializer.order(order, includes: %w[items items.product])
        )
      end

      def update_status
        order = find_record!(Order, :id, "Order")
        authorize_owner!(order)
        body = json_body
        errors = blank_errors
        status = body["status"]
        if status.nil? || status == ""
          errors["status"] << "Status is required."
        elsif !status.is_a?(String)
          errors["status"] << "Status must be a string."
        elsif !Order::STATUSES.include?(status)
          errors["status"] << "Status must be one of: #{Order::STATUSES.join(', ')}."
        end
        finish_validation!(errors)

        updated = OrderCheckout.update_status(order, status, current_user)
        includes = include_params!(*INCLUDES)
        render_success("Order status updated successfully", ApiSerializer.order(updated, includes: includes))
      end

      def destroy
        order = find_record!(Order, :id, "Order")
        OrderCheckout.destroy(order)
        render_success("Order deleted successfully", nil)
      end

      private

      def authorize_owner!(order)
        return if current_user.admin? || order.user_id == current_user.id

        raise ApiError.new("This action is unauthorized", status: 403)
      end

      def validate_filters!
        errors = blank_errors
        if params[:status].present? && !Order::STATUSES.include?(params[:status].to_s)
          errors["status"] << "Status must be one of: #{Order::STATUSES.join(', ')}."
        end
        if params[:user_id].present? && params[:user_id].to_s !~ /\A[1-9]\d*\z/
          errors["user_id"] << "user_id must be a positive integer."
        end
        finish_validation!(errors)
      end

      def validate_items!(body)
        errors = blank_errors
        items = body["items"]
        if items.nil?
          errors["items"] << "Items is required."
        elsif !items.is_a?(Array) || items.empty? || items.length > 100
          errors["items"] << "Items must be a non-empty array."
        else
          items.each_with_index do |item, index|
            unless item.is_a?(Hash)
              errors["items"] << "items.#{index} must be an object."
              next
            end
            product_id = item["product_id"] || item[:product_id]
            quantity = item["quantity"] || item[:quantity]
            unless positive_integer?(product_id)
              errors["items"] << "items.#{index}.product_id must be a positive integer."
            end
            unless positive_integer?(quantity)
              errors["items"] << "items.#{index}.quantity must be an integer greater than or equal to 1."
            end
          end
        end
        finish_validation!(errors)
        items
      end

      def positive_integer?(value)
        (value.is_a?(Integer) && value >= 1) || (value.is_a?(String) && value.match?(/\A[1-9]\d*\z/))
      end

      def preload_for(includes)
        list = []
        list << :user if includes.include?("user")
        if includes.include?("items.product")
          list << { items: :product }
        elsif includes.include?("items")
          list << :items
        end
        list.presence
      end
    end
  end
end
