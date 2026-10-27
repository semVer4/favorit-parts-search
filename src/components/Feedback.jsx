export function Loading({ children }) {
  return (
    <div className="text-secondary py-3" role="status">
      {children}
    </div>
  );
}

export function ErrorMessage({ message, onRetry }) {
  return (
    <div className="alert alert-danger" role="alert">
      <h3 className="h6">Не удалось загрузить данные</h3>
      <p>{message || "Попробуйте ещё раз через некоторое время."}</p>
      <button
        className="btn btn-outline-danger btn-sm"
        type="button"
        onClick={onRetry}
      >
        Повторить запрос
      </button>
    </div>
  );
}
