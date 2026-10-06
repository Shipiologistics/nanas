// These are existing catalogue services, not aliases for companion care.
// Keep adult_care as the stored category code so historical intake remains valid.
export const additionalIntakeServices = {
  senior_care: [
    { code: 'senior_care', name: 'Senior care', serviceId: '21000000-0000-0000-0000-000000000001' },
    { code: 'respite_care', name: 'Respite care', serviceId: '21000000-0000-0000-0000-000000000004' },
  ],
  adult_care: [
    { code: 'home_nursing', name: 'Home nursing', serviceId: '21000000-0000-0000-0000-000000000002' },
    { code: 'post_hospital_care', name: 'Post-hospital care', serviceId: '21000000-0000-0000-0000-000000000003' },
    { code: 'disability_care', name: 'Disability care', serviceId: '21000000-0000-0000-0000-000000000005' },
    { code: 'physiotherapy', name: 'Physiotherapy', serviceId: '21000000-0000-0000-0000-000000000006' },
  ],
};

/** @template {{code: string, subcategories: {code: string, serviceId: string}[]}} T
 * @param {T[]} categories
 * @param {string | undefined} serviceId
 */
export function requestIntakeSelection(categories, serviceId) {
  for (const category of categories) {
    const subcategory = category.subcategories.find(item => item.serviceId === serviceId);
    if (subcategory) return { category, subcategory };
  }
  // A fresh request may use the first choice; a supplied unknown service must
  // require a deliberate selection instead of becoming a different service.
  return { category: categories[0], subcategory: serviceId ? undefined : categories[0]?.subcategories[0] };
}
