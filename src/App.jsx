import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  brandSelected,
  fetchBrands,
  fetchOffers,
  numberChanged,
} from "./store/searchSlice.js";
import BrandList from "./components/BrandList.jsx";
import OffersTable from "./components/OffersTable.jsx";
import { ErrorMessage, Loading } from "./components/Feedback.jsx";

const SEARCH_DELAY = 450;

export default function App() {
  const dispatch = useDispatch();
  const search = useSelector((state) => state.search);
  const articleInput = useRef(null);
  const brandsTimer = useRef(null);
  const brandsRequest = useRef(null);
  const offersRequest = useRef(null);
  const {
    number,
    brands,
    selectedBrand,
    offers,
    brandsStatus,
    offersStatus,
    brandsError,
    offersError,
  } = search;

  useEffect(() => {
    if (!number.trim()) return;

    brandsTimer.current = setTimeout(() => {
      brandsRequest.current = dispatch(fetchBrands(number.trim()));
    }, SEARCH_DELAY);

    return () => {
      clearTimeout(brandsTimer.current);
      brandsRequest.current?.abort();
    };
  }, [dispatch, number]);

  useEffect(() => {
    if (!selectedBrand) return;

    offersRequest.current = dispatch(
      fetchOffers({ number: number.trim(), brand: selectedBrand }),
    );
    return () => offersRequest.current?.abort();
  }, [dispatch, number, selectedBrand]);

  function searchNow(event) {
    event?.preventDefault();
    if (!number.trim()) return;
    clearTimeout(brandsTimer.current);
    brandsRequest.current?.abort();
    brandsRequest.current = dispatch(fetchBrands(number.trim()));
  }

  function retryOffers() {
    offersRequest.current?.abort();
    offersRequest.current = dispatch(
      fetchOffers({ number: number.trim(), brand: selectedBrand }),
    );
  }

  return (
    <main className="page-container">
      <div className="page-intro">
        <h1>Поиск автозапчастей</h1>
        <p className="intro-description">
          Введите артикул и выберите производителя, чтобы посмотреть предложения
          и аналоги.
        </p>
      </div>

      <section className="search-panel" aria-labelledby="article-heading">
        <div className="section-heading">
          <h2 id="article-heading">Номер детали</h2>
        </div>
        <form onSubmit={searchNow} className="search-form">
          <label htmlFor="article" className="form-label">
            Артикул
          </label>
          <div className="search-controls">
            <div className="search-input-wrap">
              <input
                id="article"
                ref={articleInput}
                className="form-control search-input"
                type="text"
                value={number}
                onChange={(event) =>
                  dispatch(numberChanged(event.target.value))
                }
                placeholder="Например, 01089"
                autoComplete="off"
                spellCheck={false}
                maxLength={100}
                aria-describedby="article-help"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary search-button"
              disabled={!number.trim()}
            >
              Найти
            </button>
            {number && (
              <button
                type="button"
                className="btn btn-outline-secondary"
                aria-label="Очистить артикул"
                onClick={() => {
                  dispatch(numberChanged(""));
                  articleInput.current?.focus();
                }}
              >
                Очистить
              </button>
            )}
          </div>
          <div className="search-help" id="article-help">
            <span>Примеры артикулов:</span>
            {["01089", "7160500039S"].map((example) => (
              <button
                key={example}
                className="btn btn-link p-0 example-button"
                type="button"
                onClick={() => dispatch(numberChanged(example))}
              >
                {example}
              </button>
            ))}
          </div>
        </form>
      </section>

      <section
        className="brands-section"
        aria-labelledby="brands-heading"
        aria-busy={brandsStatus === "loading"}
      >
        <div className="section-heading section-heading-spaced">
          <h2 id="brands-heading">Производитель</h2>
          {brandsStatus === "succeeded" && brands.length > 0 && (
            <span className="section-count">Найдено: {brands.length}</span>
          )}
        </div>

        {!number.trim() && (
          <div className="message-panel">
            <div>
              <h3>Какую деталь ищем?</h3>
              <p>
                Введите артикул выше - здесь появятся подходящие производители.
              </p>
            </div>
          </div>
        )}
        {number.trim() &&
          (brandsStatus === "loading" || brandsStatus === "idle") && (
            <Loading>Ищем производителей…</Loading>
          )}
        {brandsStatus === "failed" && (
          <ErrorMessage message={brandsError} onRetry={searchNow} />
        )}
        {brandsStatus === "succeeded" && brands.length === 0 && (
          <div className="message-panel">
            <h3>По этому артикулу ничего не найдено</h3>
            <p>Проверьте номер детали или попробуйте другой артикул.</p>
          </div>
        )}
        {brandsStatus === "succeeded" && brands.length > 0 && (
          <BrandList
            brands={brands}
            selectedBrand={selectedBrand}
            onSelect={(brand) => dispatch(brandSelected(brand))}
          />
        )}
        {brandsStatus === "succeeded" &&
          brands.length > 0 &&
          !selectedBrand && (
            <p className="selection-hint">
              Выберите производителя, чтобы увидеть цены, остатки и аналоги
            </p>
          )}
      </section>

      {selectedBrand && (
        <section
          className="offers-section"
          aria-labelledby="offers-heading"
          aria-busy={offersStatus === "loading"}
        >
          <div className="offers-heading-row">
            <div>
              <h2 id="offers-heading">Предложения и аналоги</h2>
            </div>
            <p className="text-secondary mb-0">
              {selectedBrand}, артикул {number.trim()}
            </p>
          </div>
          {(offersStatus === "loading" || offersStatus === "idle") && (
            <Loading>Загружаем предложения и аналоги…</Loading>
          )}
          {offersStatus === "failed" && (
            <ErrorMessage message={offersError} onRetry={retryOffers} />
          )}
          {offersStatus === "succeeded" && offers.length === 0 && (
            <div className="message-panel">
              <h3>Предложений пока нет</h3>
              <p>
                Для этой детали не нашлось предложений и аналогов. Попробуйте
                выбрать другого производителя.
              </p>
            </div>
          )}
          {offersStatus === "succeeded" && offers.length > 0 && (
            <OffersTable key={`${number}-${selectedBrand}`} offers={offers} />
          )}
        </section>
      )}
    </main>
  );
}
