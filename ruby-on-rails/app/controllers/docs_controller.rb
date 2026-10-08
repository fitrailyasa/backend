class DocsController < ApplicationController
  def spec
    send_file Rails.root.join("swagger/v1/swagger.json"), type: "application/json", disposition: "inline"
  end
end
