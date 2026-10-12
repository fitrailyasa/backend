class User < ApplicationRecord
  ROLES = %w[user admin].freeze
  # Fixed bcrypt hash compared against when the email does not exist, so a
  # timing measurement cannot reveal whether an account is registered.
  DUMMY_PASSWORD_HASH = "$2a$10$qmMU69Z6V45z2NfZsKtfmubjL.xNR4.p4Fsm/ONbiQsu49wCT8VUW"

  enum :role, { user: "user", admin: "admin" }, validate: true, default: "user"

  has_many :orders, dependent: :destroy
  has_many :comments, dependent: :destroy

  validates :name, presence: true, length: { minimum: 2, maximum: 100 }
  validates :email, presence: true, length: { maximum: 150 },
                    uniqueness: { case_sensitive: false, message: "The email has already been taken." }
  validates :password, presence: true

  before_save :hash_password

  def password_matches?(plain)
    return false if plain.blank? || password.blank?

    stored = password.to_s
    stored = stored.delete_prefix("bcrypt$") if stored.start_with?("bcrypt$")
    BCrypt::Password.new(stored).is_password?(plain)
  rescue BCrypt::Errors::InvalidHash
    false
  end

  def self.password_matches_dummy?(plain)
    return false if plain.blank?

    BCrypt::Password.new(DUMMY_PASSWORD_HASH) == plain
  rescue BCrypt::Errors::InvalidHash
    false
  end

  private

  def hash_password
    return unless will_save_change_to_password?
    return if password.blank?
    return if password.match?(/\A\$2[aby]\$/)

    self.password = BCrypt::Password.create(password)
  end
end
