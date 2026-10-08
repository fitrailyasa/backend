USE `backend_starter`;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version varchar(255) NOT NULL PRIMARY KEY
);

INSERT IGNORE INTO schema_migrations (version) VALUES ('20261008100000');
