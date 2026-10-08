"""Flask CLI commands."""

import click
from flask.cli import with_appcontext

from app.services.seed_service import seed_demo_data


def register_commands(app):
    @app.cli.command("seed")
    @with_appcontext
    def seed():
        """Reset the database and insert the shared demo catalogue."""
        summary = seed_demo_data(reset=True)
        click.echo(f"[seed] demo data created: {summary}")
        click.echo("[seed] admin login -> admin@example.com / password")
