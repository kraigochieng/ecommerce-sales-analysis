from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from ecommerce_sales_analysis.config import settings
from ecommerce_sales_analysis.db.models import Base

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    # connect_args={"sslmode": "require"}
)

Session = sessionmaker(bind=engine)


def test_connection():
    """
    Simple function to verify connectivity.
    """
    try:
        with engine.connect() as connection:
            # Execute a simple query
            Base.metadata.drop_all(engine)
            print("Dropped star schema")
            result = connection.execute(text("SELECT 1"))

            print("Connection successful!")
            print(f"Database: {settings.DB_NAME}")
            print(f"Host: {settings.DB_HOST}")

            Base.metadata.create_all(engine)
            print("Created star schema")
    except Exception as e:
        print("❌ Connection failed")
        print(e)


if __name__ == "__main__":
    test_connection()
