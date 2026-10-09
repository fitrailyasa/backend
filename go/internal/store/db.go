package store

import (
	"fmt"

	"github.com/backend-starter/go/internal/config"
	"github.com/backend-starter/go/internal/model"
	"github.com/glebarez/sqlite"
	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(cfg config.Config) (*gorm.DB, error) {
	logMode := logger.Silent
	if cfg.DBLogging {
		logMode = logger.Info
	}
	gormCfg := &gorm.Config{Logger: logger.Default.LogMode(logMode)}

	var dialector gorm.Dialector
	switch cfg.Dialect {
	case "sqlite":
		dialector = sqlite.Open(cfg.Storage)
	default:
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=true&loc=UTC",
			cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName)
		dialector = gormmysql.Open(dsn)
	}

	db, err := gorm.Open(dialector, gormCfg)
	if err != nil {
		return nil, err
	}

	if cfg.Dialect == "sqlite" {
		sqlDB, err := db.DB()
		if err != nil {
			return nil, err
		}
		sqlDB.SetMaxOpenConns(1)
		if err := db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
			return nil, err
		}
	}

	if cfg.Sync {
		if err := db.AutoMigrate(
			&model.User{},
			&model.Category{},
			&model.Tag{},
			&model.Product{},
			&model.ProductTag{},
			&model.Order{},
			&model.OrderItem{},
			&model.Comment{},
		); err != nil {
			return nil, err
		}
	}

	return db, nil
}
