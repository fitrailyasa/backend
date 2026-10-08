FROM eclipse-temurin:21-jdk-jammy AS build

WORKDIR /app

COPY . .
RUN chmod +x mvnw && ./mvnw -q -DskipTests package

FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

COPY --from=build /app/target/starter-1.0.0.jar app.jar

ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
