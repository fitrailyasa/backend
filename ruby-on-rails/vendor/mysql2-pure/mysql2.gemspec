Gem::Specification.new do |spec|
  spec.name = "mysql2"
  spec.version = "0.5.7"
  spec.summary = "Pure Ruby Mysql2::Client compatible with Active Record"
  spec.authors = ["backend-starter"]
  spec.files = Dir["lib/**/*.rb"]
  spec.require_paths = ["lib"]
  spec.add_dependency "ruby-mysql", "~> 4.2"
end
