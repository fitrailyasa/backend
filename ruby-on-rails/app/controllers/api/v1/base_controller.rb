module Api
  module V1
    class BaseController < ApplicationController
      include Authenticatable
      include ContractValidation
      include ApiQueries
    end
  end
end
