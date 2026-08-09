interface RestaurantCardProps {
  name: string;
  address: string;
  category?: string;
  rating?: number | null;
  occasion?: string | null;
  foodType?: string | null;
  cuisine?: string | null;
}

export function RestaurantCard({
  name,
  address,
  category,
  rating,
  occasion,
  foodType,
  cuisine,
}: RestaurantCardProps) {
  return (
    <div className="restaurant-card">
      <div className="restaurant-card-name">{name}</div>
      <div className="restaurant-card-address">{address}</div>
      {category && <div className="restaurant-card-category">{category}</div>}
      {(occasion || foodType || cuisine) && (
        <div className="restaurant-card-tags">
          {occasion && <span className="tag tag-occasion">{occasion}</span>}
          {foodType && <span className="tag tag-food-type">{foodType}</span>}
          {cuisine && <span className="tag tag-cuisine">{cuisine}</span>}
        </div>
      )}
      {rating != null && (
        <div className="restaurant-card-rating">
          {"★".repeat(rating)}
          {"☆".repeat(5 - rating)}
        </div>
      )}
    </div>
  );
}
