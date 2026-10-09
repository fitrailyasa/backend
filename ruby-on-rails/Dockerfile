FROM ruby:3.3

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY Gemfile Gemfile.lock ./
COPY vendor/mysql2-pure vendor/mysql2-pure
ENV BUNDLE_WITHOUT=test
RUN bundle install

COPY . .

ENV RAILS_ENV=development
ENV PORT=3001

EXPOSE 3001

CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0", "-p", "3001"]
