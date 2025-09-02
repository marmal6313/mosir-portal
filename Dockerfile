FROM node:20-alpine

WORKDIR /app

# Kopiuj pliki package.json i package-lock.json
COPY package*.json ./

# Zainstaluj wszystkie zależności (w tym dev dependencies potrzebne do build'u)
RUN npm ci

# Kopiuj kod aplikacji
COPY . .

# Usuń katalogi dokumentacji/testów, które nie są potrzebne do build/runtime
# (zapobiega błędom type-checkera związanym z Docusaurusem itp.)
RUN rm -rf ./docs-portal ./docs ./_archive

# Narzędzia pomocnicze dla healthcheck (curl)
RUN apk add --no-cache curl

# Build-time args dla publicznych zmiennych Next.js
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Ustaw je również jako ENV, aby były dostępne podczas build'u i runtime
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

# Wyłącz telemetrię Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Zbuduj aplikację
RUN npm run build

# Usuń dev dependencies po build'u
RUN npm prune --omit=dev

# Eksponuj port 3000
EXPOSE 3000

# Uruchom aplikację
CMD ["npm", "start"]
