interface RestaurantCardProps {
  name: string;
  address: string;
  category?: string;
  rating?: number | null;
}

export function RestaurantCard({ name, address, category, rating }: RestaurantCardProps) {
  return (
    <div className="restaurant-card">
      <div className="restaurant-card-name">{name}</div>
      <div className="restaurant-card-address">{address}</div>
      {category && <div className="restaurant-card-category">{category}</div>}
      {rating != null && (
        <div className="restaurant-card-rating">
          {"★".repeat(rating)}
          {"☆".repeat(5 - rating)}
        </div>
      )}
    </div>
  );
}
