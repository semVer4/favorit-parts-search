import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import OffersTable from "./OffersTable.jsx";

const offers = [
  {
    id: "meyle-dmd",
    name: "Масляный фильтр",
    brand: "MEYLE",
    number: "01089",
    warehouse: "ДМД",
    price: 1200,
    stock: 2,
    isAnalogue: false,
  },
  {
    id: "bosch-spb",
    name: "Фильтр-заменитель",
    brand: "BOSCH",
    number: "0986",
    warehouse: "СПБ",
    price: 800,
    stock: 4,
    isAnalogue: true,
  },
  {
    id: "febi-unavailable",
    name: "Недоступный фильтр",
    brand: "FEBI",
    number: "1234",
    warehouse: "",
    price: null,
    stock: 0,
    isAnalogue: true,
  },
];

describe("таблица предложений", () => {
  it("показывает цену и остаток вместе с нужным складом, а отсутствие цены — отдельно", () => {
    render(<OffersTable offers={[offers[1], offers[0], offers[2]]} />);
    const meyleRow = screen.getByText("Масляный фильтр").closest("tr");
    const boschRow = screen.getByText("Фильтр-заменитель").closest("tr");
    const unavailableRow = screen.getByText("Недоступный фильтр").closest("tr");

    expect(meyleRow).toHaveTextContent("ДМД");
    expect(meyleRow).toHaveTextContent("2 шт.");
    expect(meyleRow).toHaveTextContent("1 200,00 ₽");
    expect(within(meyleRow).getByText("Искомая деталь")).toBeInTheDocument();
    expect(boschRow).toHaveTextContent("СПБ");
    expect(boschRow).toHaveTextContent("4 шт.");
    expect(boschRow).toHaveTextContent("800,00 ₽");
    expect(within(boschRow).getByText("Аналог")).toBeInTheDocument();
    expect(unavailableRow).toHaveTextContent("Нет в наличии");
    expect(
      within(unavailableRow).getByLabelText("Цена не указана"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).getAllByRole("row")[1],
    ).toHaveTextContent("Искомая деталь");
  });

  it("сортирует предложения по цене, оставляя позиции без цены в конце", async () => {
    const user = userEvent.setup();
    render(<OffersTable offers={offers} />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Сортировка предложений" }),
      "price",
    );

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Фильтр-заменитель");
    expect(rows[1]).toHaveTextContent("Масляный фильтр");
    expect(rows[2]).toHaveTextContent("Недоступный фильтр");
    expect(offers[0].id).toBe("meyle-dmd");
  });

  it("фильтрует наличие и позволяет сбросить фильтр, если доступных позиций нет", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OffersTable offers={offers} />);
    await user.click(
      screen.getByRole("checkbox", { name: "Только в наличии" }),
    );

    expect(screen.queryByText("Недоступный фильтр")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      3,
    );

    rerender(<OffersTable offers={[offers[2]]} />);
    expect(screen.getByText("Предложений в наличии нет")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Показать все предложения" }),
    );

    expect(screen.getByText("Недоступный фильтр")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Только в наличии" }),
    ).not.toBeChecked();
  });

  it("показывает 25 предложений на странице и сбрасывает страницу при сортировке или фильтрации", async () => {
    const user = userEvent.setup();
    const manyOffers = Array.from({ length: 27 }, (_, index) => ({
      ...offers[0],
      id: String(index),
      name: `Деталь ${index + 1}`,
      price: index + 1,
      stock: index < 25 ? 1 : 0,
    }));
    render(<OffersTable offers={manyOffers} />);

    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      26,
    );
    expect(screen.queryByText("Деталь 26")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Назад" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText("Деталь 26")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      3,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Сортировка предложений" }),
      "price",
    );
    expect(screen.getByText("Деталь 1", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Назад" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(
      screen.getByRole("checkbox", { name: "Только в наличии" }),
    );
    expect(screen.getByText("Деталь 1", { exact: true })).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Страницы предложений" }),
    ).not.toBeInTheDocument();
  });
});
