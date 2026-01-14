import React, { useEffect, useState } from "react";
import axios from "axios";

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("/api/dashboard")
      .then((res) => {
        setStats(res.data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading dashboard...</div>;

  if (!stats)
    return <div>Unable to load dashboard data. Please check API server.</div>;

  return (
    <div>
      <h1>Kmonstar Sales Dashboard</h1>
      <h2>Summary</h2>
      <ul>
        <li>Total products: {stats.summary.totalProducts}</li>
        <li>Total variants: {stats.summary.totalVariants}</li>
        <li>Total orders: {stats.summary.totalOrders}</li>
        <li>Total revenue: ${stats.summary.totalRevenue}</li>
        <li>Average order value: ${stats.averageOrderValue}</li>
      </ul>
      <h2>Order Statuses</h2>
      <ul>
        {Object.entries(stats.orderStatuses).map(([status, count]) => (
          <li key={status}>{status}: {count}</li>
        ))}
      </ul>
      <h2>Top Products</h2>
      <ul>
        {stats.topProducts.map((prod) => (
          <li key={prod.productId}>
            {prod.name} (Orders: {prod.orderCount})
          </li>
        ))}
      </ul>
      <h2>Recent Orders</h2>
      <ul>
        {stats.recentOrders.map((order) => (
          <li key={order.id}>
            Product: {order.productId}, Customer: {order.customerEmail}, Qty: {order.quantity}, Status: {order.status}
          </li>
        ))}
      </ul>
      <p>Last updated: {String(stats.lastUpdated)}</p>
    </div>
  );
}

export default Dashboard;
