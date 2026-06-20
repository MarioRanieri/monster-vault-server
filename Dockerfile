# ── STAGE 1: Build backend + embed frontend ──────────
FROM maven:3.9-eclipse-temurin-17-alpine AS build
WORKDIR /app
COPY backend/pom.xml .
RUN mvn dependency:go-offline -B
COPY backend/src/ src/
COPY frontend/src/ src/main/resources/static/
RUN mvn package -DskipTests -B

# ── STAGE 2: Run ──────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java -jar app.jar --server.port=${PORT:-8080}"]
