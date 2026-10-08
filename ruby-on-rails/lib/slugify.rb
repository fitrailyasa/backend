module Slugify
  module_function

  def call(value, max: 120)
    value.to_s
         .unicode_normalize(:nfkd)
         .gsub(/\p{M}/, "")
         .downcase
         .strip
         .gsub(/['"`]/, "")
         .gsub(/[^a-z0-9]+/, "-")
         .gsub(/\A-+|-+\z/, "")
         .gsub(/-{2,}/, "-")
         .slice(0, max)
         .to_s
  end
end
