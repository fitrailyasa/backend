module Api
  module V1
    class UsersController < BaseController
      before_action :authenticate!
      before_action :require_admin!, except: %i[me update_me]

      def index
        paging = pagination_params!
        scope = apply_search(User.all, %w[name email], paging[:search])
        if params[:role].present?
          unless User::ROLES.include?(params[:role].to_s)
            finish_validation!("role" => ["Role must be one of: user, admin."])
          end
          scope = scope.where(role: params[:role])
        end
        rows, meta = paginate(scope, paging: paging, sortable: %w[id name email role created_at updated_at])
        render_success("Users retrieved", rows.map { |user| ApiSerializer.user(user) }, meta: meta)
      end

      def show
        render_success("User retrieved", ApiSerializer.user(find_record!(User, :id, "User")))
      end

      def me
        render_success("User retrieved", ApiSerializer.user(current_user))
      end

      def create
        body = json_body
        errors = blank_errors
        name = string_field(errors, body, "name", label: "Name", required: true, min: 2, max: 100)
        email = email_field(errors, body, required: true)
        password = password_field(errors, body, required: true, confirm: false)
        role = role_field(errors, body, required: false)
        errors["email"] << "The email has already been taken." if email.present? && email_taken?(email)
        finish_validation!(errors)

        user = User.create!(name: name, email: email, password: password, role: role || "user")
        render_created("User created successfully", ApiSerializer.user(user))
      end

      def update
        user = find_record!(User, :id, "User")
        body = json_body
        errors = blank_errors
        replacing = request.put?
        name = string_field(errors, body, "name", label: "Name", required: replacing, min: 2, max: 100)
        email = email_field(errors, body, required: replacing)
        password = password_field(errors, body, required: replacing, confirm: false)
        role = role_field(errors, body, required: false)
        errors["email"] << "The email has already been taken." if email.present? && email_taken?(email, except_id: user.id)
        finish_validation!(errors)

        user.name = name if replacing || body.key?("name")
        user.email = email if replacing || body.key?("email")
        user.password = password if body.key?("password") && password.present?
        user.role = role if role.present?
        user.save!
        render_success("User updated successfully", ApiSerializer.user(user))
      end

      def update_me
        user = current_user
        body = json_body
        errors = blank_errors
        name = string_field(errors, body, "name", label: "Name", required: false, min: 2, max: 100)
        email = email_field(errors, body, required: false)
        password = password_field(errors, body, required: false, confirm: false)
        if body.key?("password_confirmation") && body["password_confirmation"].present? && password.blank?
          errors["password_confirmation"] << "Password is required when password_confirmation is provided."
        end
        errors["email"] << "The email has already been taken." if email.present? && email_taken?(email, except_id: user.id)
        finish_validation!(errors)

        user.name = name if body.key?("name") && name.present?
        user.email = email if body.key?("email") && email.present?
        user.password = password if body.key?("password") && password.present?
        user.save!
        render_success("Profile updated successfully", ApiSerializer.user(user))
      end

      def destroy
        find_record!(User, :id, "User").destroy!
        render_success("User deleted successfully", nil)
      end

      private

      def role_field(errors, body, required:)
        return nil unless required || body.key?("role")
        if !body.key?("role") || body["role"].nil? || body["role"] == ""
          errors["role"] << "Role is required." if required
          return nil
        end
        unless body["role"].is_a?(String)
          errors["role"] << "Role must be a string."
          return nil
        end
        unless User::ROLES.include?(body["role"])
          errors["role"] << "Role must be one of: user, admin."
          return nil
        end
        body["role"]
      end
    end
  end
end
