import {
  createCompany,
  deserializeCompanyFromApi,
  serializeCompanyForApi
} from "../models/company-model.js";
import { seedCompanies } from "../data/mock-data.js";
import { STORAGE_KEYS, storageService } from "./storage-service.js";
import { supabaseService } from "./supabase-service.js";

function sortCompanies(companies) {
  return [...companies].sort((left, right) => {
    if (right.contributionValue !== left.contributionValue) {
      return right.contributionValue - left.contributionValue;
    }

    return left.companyName.localeCompare(right.companyName);
  });
}

function readStoredCompanies() {
  return storageService
    .read(STORAGE_KEYS.companies, [])
    .map((company) => createCompany(company));
}

export const companyService = {
  async loadCompanies() {
    if (supabaseService.isReady()) {
      const records = await supabaseService.list("companies");
      const companies = sortCompanies(records.map(deserializeCompanyFromApi));
      storageService.write(STORAGE_KEYS.companies, companies);
      return companies;
    }

    const storedCompanies = readStoredCompanies();
    if (storedCompanies.length) {
      return sortCompanies(storedCompanies);
    }

    const companies = sortCompanies(seedCompanies.map((company) => createCompany(company)));
    storageService.write(STORAGE_KEYS.companies, companies);
    return companies;
  },
  async saveCompany(input) {
    const company = createCompany(input);
    const currentCompanies = readStoredCompanies();
    const exists = currentCompanies.some((item) => item.id === company.id);
    const nextCompanies = sortCompanies(
      exists
        ? currentCompanies.map((item) => (item.id === company.id ? company : item))
        : [...currentCompanies, company]
    );

    storageService.write(STORAGE_KEYS.companies, nextCompanies);

    if (supabaseService.isReady()) {
      await supabaseService.upsert("companies", serializeCompanyForApi(company));
    }

    return company;
  },
  async deleteCompany(id) {
    const nextCompanies = readStoredCompanies().filter((company) => company.id !== id);
    storageService.write(STORAGE_KEYS.companies, nextCompanies);

    if (supabaseService.isReady()) {
      await supabaseService.remove("companies", id);
    }

    return nextCompanies;
  }
};
