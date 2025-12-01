from sqlalchemy import Column, Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class FactOrder(Base):
    __tablename__ = "fact_order"

    # Primary Keys
    order_id = Column(String, primary_key=True)

    # Foreign Keys
    customer_key = Column(
        String(50), ForeignKey("dim_customer.customer_id"), nullable=False
    )
    region_key = Column(Integer, ForeignKey("dim_region.region_id"))
    product_key = Column(Integer, ForeignKey("dim_product.product_id"))
    date_key = Column(Date, ForeignKey("dim_date.date_id"))

    product_price = Column(Numeric(10, 2))
    quantity = Column(Integer, nullable=False)
    delivery_days = Column(Integer)
    is_returned = Column(Integer)
    customer_rating = Column(Numeric(2, 1))
    discount_percent = Column(Integer)
    revenue = Column(Numeric(10, 2), nullable=False)

    # Relationships
    customer_dim = relationship("DimCustomer", back_populates="orders_cleaned")
    region_dim = relationship("DimRegion", back_populates="orders_cleaned")
    product_dim = relationship("DimProduct", back_populates="orders_cleaned")
    date_dim = relationship("DimDate", back_populates="orders_cleaned")


class DimDate(Base):
    __tablename__ = "dim_date"

    # Primary Key - using the order_date as the key for simplicity
    date_id = Column(Date, primary_key=True)

    # Descriptive Attributes (Optional, but good practice)
    order_date_year = Column(Integer)
    order_date_month = Column(Integer)
    order_date_year_month_str = Column(String(7))  # e.g., '2025-10'

    # Relationship to the Fact Table
    orders = relationship("FactOrder", back_populates="date_dim")


class DimRegion(Base):
    __tablename__ = "dim_region"

    region_id = Column(Integer, primary_key=True)
    region_name = Column(String(50), unique=True, nullable=False)

    orders = relationship("FactOrder", back_populates="region_dim")


class DimProduct(Base):
    __tablename__ = "dim_product"

    product_id = Column(Integer, primary_key=True)
    product_category = Column(String(50), unique=True, nullable=False)

    orders = relationship("FactOrder", back_populates="product_dim")


class DimCustomer(Base):
    __tablename__ = "dim_customer"

    customer_id = Column(String(50), primary_key=True)

    orders = relationship("FactOrder", back_populates="customer_dim")
