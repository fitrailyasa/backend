Rails.application.routes.draw do
  get "/health", to: "health#show"

  namespace :api, defaults: { format: :json } do
    namespace :v1 do
      get "/", to: "root#show"

      post "auth/register", to: "auth#register"
      post "auth/login", to: "auth#login"
      post "auth/refresh", to: "auth#refresh"
      post "auth/logout", to: "auth#logout"
      get "auth/me", to: "auth#me"

      get "users/me", to: "users#me"
      patch "users/me", to: "users#update_me"
      resources :users, except: %i[new edit]

      resources :categories, except: %i[new edit]
      resources :products, except: %i[new edit] do
        resources :comments, only: %i[index create]
      end
      resources :tags, except: %i[new edit]

      resources :orders, only: %i[index show create destroy] do
        member do
          patch :status, action: :update_status
        end
      end
      resources :comments, only: %i[index update destroy]
    end
  end

  get "/api/v1/docs.json", to: "docs#spec"
  mount Rswag::Ui::Engine => "/api/v1/docs"
  mount Rswag::Api::Engine => "/api/v1/docs"

  match "*unmatched", to: "application#route_not_found", via: :all
end
