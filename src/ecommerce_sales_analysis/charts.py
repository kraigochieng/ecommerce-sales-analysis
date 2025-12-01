import plotly.express as px

# BRAND_COLOR = "#5D9CEC"
BRAND_COLOR = "#FFFFFF"

def plot_line_chart(df, x_col, y_col, title, color_col=None):
    """Generic function to create consistent line charts."""
    fig = px.line(
        df,
        x=x_col,
        y=y_col,
        color=color_col,
        title=title,
        markers=True,
    )
    # You can apply global styling here (e.g., standardizing fonts)
    return fig


def plot_growth_chart(df):
    """Specific function for the Growth/AOV chart."""
    fig = px.line(
        df,
        x="order_date_year_month",
        y="Growth Rate",
        color="Metric",
        title="Growth Correlation: Revenue vs. AOV (MoM %)",
        markers=True,
        color_discrete_sequence=["#5D9CEC", "#FF6B6B"],
        labels={"Growth Rate": "MoM Growth (%)", "order_date_year_month": "Month"},
    )
    fig.add_hline(y=0, line_dash="dash", line_color="gray", opacity=0.5)

    fig.update_layout(
        height=300,  # Slightly taller than CSAT because it has 2 lines
        margin=dict(l=20, r=20, t=40, b=20),
        legend=dict(
            orientation="h",  # Horizontal legend
            yanchor="bottom",
            y=1.02,  # Place it right above the chart
            xanchor="right",
            x=1,
        ),
    )
    return fig


def plot_csat_delivery_trend(df):
    """Creates a line chart showing how rating drops as delivery takes longer."""
    fig = px.line(
        df,
        x="delivery_days",
        y="avg_rating",
        title="Impact of Delivery Speed on Customer Satisfaction",
        labels={
            "delivery_days": "Delivery Time (Days)",
            "avg_rating": "Average Rating (1-5 stars)",
        },
        color_discrete_sequence=[BRAND_COLOR],
        markers=True,
    )

    # Force Y-axis to show the full rating scale (or at least 1 to 5)
    # This prevents a tiny drop from 4.9 to 4.8 looking like a crash to zero.
    fig.update_yaxes(range=[1, 5])

    fig.update_layout(
        height=250,  # Force small height
        margin=dict(l=20, r=20, t=40, b=20),  # Tight margins
        xaxis_title=None,  # Remove axis title if the graph is obvious
        yaxis_title=None,
    )

    return fig


def plot_avg_delivery_by_region(df):
    """Creates a bar chart for Average Delivery Time per Region."""
    fig = px.bar(
        df,
        x="region",
        y="avg_delivery_days",
        title="Average Delivery Time by Region",
        labels={"region": "Region", "avg_delivery_days": "Avg Days"},
        color="avg_delivery_days",  # Color by value
        color_continuous_scale="Reds",  # Red = Slower (Bad)
        text_auto=True,  # Show the numbers on top of the bars
    )
    fig.update_layout(coloraxis_showscale=False)  # Hide the color bar to keep it clean
    return fig


def plot_breakdown_bar(df, x_col, y_col, title, color_theme="Blues"):
    """
    Generic bar chart for metric breakdowns.
    """
    fig = px.bar(
        df,
        x=x_col,
        y=y_col,
        title=title,
        text_auto=".2s",  # Format numbers (e.g., 1.2M)
        # color=y_col,
        # color_continuous_scale=color_theme,
        color_discrete_sequence=[BRAND_COLOR]
    )
    # Hide the color bar to keep it clean and set a consistent height
    fig.update_layout(coloraxis_showscale=False, height=250)
    return fig
