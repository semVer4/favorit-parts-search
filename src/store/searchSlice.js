import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { findBrands, findOffers } from "../api/partsApi.js";

export const fetchBrands = createAsyncThunk(
  "search/fetchBrands",
  async (number, { signal, rejectWithValue }) => {
    try {
      return await findBrands(number.trim(), signal);
    } catch (error) {
      if (signal.aborted || error?.name === "AbortError") throw error;
      return rejectWithValue(
        error?.message || "Не удалось получить производителей",
      );
    }
  },
  {
    condition: (number, { getState }) =>
      Boolean(number.trim()) &&
      getState().search.number.trim() === number.trim(),
  },
);

export const fetchOffers = createAsyncThunk(
  "search/fetchOffers",
  async ({ number, brand }, { signal, rejectWithValue }) => {
    try {
      return await findOffers(number.trim(), brand, signal);
    } catch (error) {
      if (signal.aborted || error?.name === "AbortError") throw error;
      return rejectWithValue(
        error?.message || "Не удалось получить предложения",
      );
    }
  },
  {
    condition: ({ number, brand }, { getState }) => {
      const search = getState().search;
      return (
        Boolean(number.trim() && brand) &&
        search.number.trim() === number.trim() &&
        search.selectedBrand === brand
      );
    },
  },
);

const initialState = {
  number: "",
  brands: [],
  selectedBrand: "",
  offers: [],
  brandsStatus: "idle",
  offersStatus: "idle",
  brandsError: null,
  offersError: null,
  brandsRequestId: null,
  offersRequestId: null,
};

function resetOffers(state) {
  state.offers = [];
  state.offersStatus = "idle";
  state.offersError = null;
  state.offersRequestId = null;
}

function currentBrandsRequest(state, action) {
  return (
    state.brandsRequestId === action.meta.requestId &&
    state.number.trim() === action.meta.arg.trim()
  );
}

function currentOffersRequest(state, action) {
  return (
    state.offersRequestId === action.meta.requestId &&
    state.number.trim() === action.meta.arg.number.trim() &&
    state.selectedBrand === action.meta.arg.brand
  );
}

const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    numberChanged(state, action) {
      if (state.number === action.payload) return;
      return { ...initialState, number: action.payload };
    },
    brandSelected(state, action) {
      if (state.selectedBrand === action.payload) return;
      state.selectedBrand = action.payload;
      resetOffers(state);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBrands.pending, (state, action) => {
        if (state.number.trim() !== action.meta.arg.trim()) return;
        state.brandsStatus = "loading";
        state.brands = [];
        state.brandsError = null;
        state.brandsRequestId = action.meta.requestId;
        state.selectedBrand = "";
        resetOffers(state);
      })
      .addCase(fetchBrands.fulfilled, (state, action) => {
        if (!currentBrandsRequest(state, action)) return;
        state.brands = action.payload;
        state.brandsStatus = "succeeded";
        state.brandsRequestId = null;
      })
      .addCase(fetchBrands.rejected, (state, action) => {
        if (!currentBrandsRequest(state, action)) return;
        state.brandsStatus = action.meta.aborted ? "idle" : "failed";
        state.brandsError = action.meta.aborted
          ? null
          : action.payload || "Не удалось получить производителей";
        state.brandsRequestId = null;
      })
      .addCase(fetchOffers.pending, (state, action) => {
        if (
          state.number.trim() !== action.meta.arg.number.trim() ||
          state.selectedBrand !== action.meta.arg.brand
        )
          return;
        state.offersStatus = "loading";
        state.offers = [];
        state.offersError = null;
        state.offersRequestId = action.meta.requestId;
      })
      .addCase(fetchOffers.fulfilled, (state, action) => {
        if (!currentOffersRequest(state, action)) return;
        state.offers = action.payload;
        state.offersStatus = "succeeded";
        state.offersRequestId = null;
      })
      .addCase(fetchOffers.rejected, (state, action) => {
        if (!currentOffersRequest(state, action)) return;
        state.offersStatus = action.meta.aborted ? "idle" : "failed";
        state.offersError = action.meta.aborted
          ? null
          : action.payload || "Не удалось получить предложения";
        state.offersRequestId = null;
      });
  },
});

export const { numberChanged, brandSelected } = searchSlice.actions;
export default searchSlice.reducer;
