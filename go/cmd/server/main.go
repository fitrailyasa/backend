package main

import (
	"fmt"
	"log"
	"os"

	"github.com/backend-starter/go/internal/config"
	"github.com/backend-starter/go/internal/httpapi"
	"github.com/backend-starter/go/internal/seed"
	"github.com/backend-starter/go/internal/store"
)

func main() {
	cfg := config.Load()
	db, err := store.Open(cfg)
	if err != nil {
		log.Fatalf("[boot] database: %v", err)
	}

	if len(os.Args) > 1 && os.Args[1] == "seed" {
		if err := seed.Run(db, cfg); err != nil {
			log.Fatalf("[seed] %v", err)
		}
		return
	}

	server := httpapi.New(cfg, db)
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	log.Printf("[http] listening on http://%s", addr)
	log.Printf("[http] docs at http://%s%s/docs", addr, cfg.Prefix)
	if err := server.Run(addr); err != nil {
		log.Fatalf("[http] %v", err)
	}
}
