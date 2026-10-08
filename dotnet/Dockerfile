FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src

COPY . .
RUN dotnet publish src/Backend.Api/Backend.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0

WORKDIR /app

COPY --from=build /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://0.0.0.0:5080
ENV Urls=http://0.0.0.0:5080

EXPOSE 5080

ENTRYPOINT ["dotnet", "Backend.Api.dll"]
