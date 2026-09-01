// Package web embeds the built frontend (frontend/dist, copied here
// by `make build-frontend` or the Dockerfile before `go build`) into the
// backend binary, and serves it as a single-page app: any path that isn't
// a real file falls back to index.html so client-side routing works.
package web

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed all:dist
var distFS embed.FS

// Handler returns an http.Handler serving the embedded frontend, with SPA
// fallback to index.html for unknown paths (so e.g. /servers/foo loads the
// app instead of 404ing on a browser refresh).
func Handler() http.Handler {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic(err)
	}
	fileServer := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := fs.Stat(sub, cleanPath(r.URL.Path)); err != nil {
			r2 := new(http.Request)
			*r2 = *r
			r2.URL.Path = "/"
			fileServer.ServeHTTP(w, r2)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}

func cleanPath(p string) string {
	if p == "" || p == "/" {
		return "index.html"
	}
	if p[0] == '/' {
		p = p[1:]
	}
	return p
}
