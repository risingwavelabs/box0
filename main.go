package main

import (
	"log"
	"os"
)

func main() {
	dbPath := os.Getenv("STREAM0_DB")
	if dbPath == "" {
		dbPath = "./agentbus.db"
	}

	port := os.Getenv("STREAM0_PORT")
	if port == "" {
		port = "8080"
	}

	host := os.Getenv("STREAM0_HOST")
	if host == "" {
		host = "127.0.0.1"
	}

	// Initialize database
	db, err := NewDatabase(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Create and start server
	server := NewServer(db)
	addr := host + ":" + port
	log.Printf("stream0 starting on http://%s", addr)
	if err := server.Run(addr); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
