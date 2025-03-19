import { assert } from './assert.js';
import { CreditsMoteDataPointer } from './cl2.credits.pointers.js';
import {
  linePatterns,
  type CreditsUpdateResult,
  type CreditsUpdateResultRole,
  type CreditsUpdateResultSection,
} from './cl2.credits.types.js';
import { prepareParserHelpers } from './cl2.shared.parse.js';
import { CreditsMote, creditsSchemaId } from './cl2.shared.types.js';
import type { GameChanger } from './GameChanger.js';
import {
  bsArrayToArray,
  createBsArrayKey,
  updateBsArrayOrder,
} from './helpers.js';

export function parseStringifiedCredits(
  text: string,
  packed: GameChanger,
): CreditsUpdateResult {
  const result: CreditsUpdateResult = {
    diagnostics: [],
    hovers: [],
    edits: [],
    completions: [],
    words: [],
    parsed: {
      sections: [],
      comments: [], // Don't really need this, but here for consistency
    },
  };

  const helpers = prepareParserHelpers(
    text,
    packed,
    { schemaId: creditsSchemaId },
    result,
  );

  let currentSection: CreditsUpdateResultSection | undefined = undefined;
  let currentRole: CreditsUpdateResultRole | undefined = undefined;

  for (const line of helpers.lines) {
    const trace: any[] = [];
    try {
      // Is this just a blank line?
      if (!line) {
        continue;
      }
      const parsedLine = helpers.parseCurrentLine(linePatterns);
      if (!parsedLine) continue;

      const indicator = parsedLine.indicator?.value;
      if (indicator === '===') {
        // Then this is a Gap entry
        assert(currentSection, 'Gaps are not supported');
      } else if (indicator?.startsWith('\t-')) {
        // Then this is a specific person and they need to be added
        // to the current role
        assert(currentRole, 'Cannot add a person without being in a Role');
        const name = parsedLine.text?.value;
        // Detect if it's a CJK name
        const cjk = name && /^[\u4E00-\u9FFF]+$/.test(name);
        currentRole.names.push({
          name: name ?? '',
          cjk: !!cjk,
        });
      } else if (indicator?.startsWith('\t') && line.trim()) {
        // Then this is a Role line
        currentRole = {
          id: parsedLine.arrayTag?.value || '',
          type: 'role',
          role: parsedLine.text?.value || '',
          names: [],
        };
        if (!currentRole.id) {
          currentRole.id = createBsArrayKey();
          result.edits.push({
            newText: `#${currentRole.id} `,
            start: parsedLine.indicator!.end,
            end: parsedLine.indicator!.end,
          });
        }
        assert(currentSection, 'Cannot add a Role without being in a Section');
        currentSection.roles.push(currentRole);
      } else if (!line.match(/^\s+/)) {
        // Then this is a Section line
        currentSection = {
          id: parsedLine.arrayTag?.value || '',
          title: parsedLine.text?.value || '',
          roles: [],
        };
        if (!currentSection.id) {
          currentSection.id = createBsArrayKey();
          result.edits.push({
            newText: `#${currentSection.id} `,
            start: parsedLine.indicator!.end,
            end: parsedLine.indicator!.end,
          });
        }
        result.parsed.sections.push(currentSection);
      }
    } catch (err) {
      if (err instanceof Error) {
        err.cause = trace;
      }
      throw err;
    }
    helpers.index += line.length;
  }

  return result;
}

export async function updateChangesFromParsedCredits(
  parsed: CreditsUpdateResult['parsed'],
  moteId: string,
  packed: GameChanger,
): Promise<void> {
  const _traceLogs: any[] = [];
  const trace = (log: any) => _traceLogs.push(log);
  trace(`Updating mote ${moteId}`);
  try {
    // We're always going to be computing ALL changes, so clear whatever
    // we previously had.
    packed.clearMoteChanges(moteId, ['data/sections/*']);
    const moteWorking = packed.working.getMote(moteId) as CreditsMote;
    const moteBase = packed.base.getMote(moteId) as CreditsMote;
    assert(moteWorking, `Mote ${moteId} not found in working copy`);
    const schema = packed.working.getSchema(moteWorking.schema_id);
    assert(schema, `${moteWorking.schema_id} schema not found in working copy`);
    assert(schema.name, 'Chat mote must have a name pointer');

    const updateMote = (path: CreditsMoteDataPointer, value: any) => {
      packed.updateMoteData(moteId, path, value);
    };

    trace('Finding existing Credits identifiers');
    // Collect what's currently in the mote so we can do some
    // lookups to minimize ID changes and identify stuff to delete
    /** SectionID:RoleID:PersonID:Name */
    const existingSectionsNameLookup = new Map<
      string,
      Map<string, Map<string, string>>
    >();
    /** SectionID:RoleID:Name:PersonId */
    const existingSectionsPersonIdLookup = new Map<
      string,
      Map<string, Map<string, string>>
    >();
    /** SectiondId:RoleIds for single entry roles */
    const singleEntryRoleIdLookup = new Map<string, Set<string>>();
    for (const section of bsArrayToArray(moteBase.data.sections!)) {
      const sectionId = section.id;
      existingSectionsNameLookup.set(sectionId, new Map());
      existingSectionsPersonIdLookup.set(sectionId, new Map());
      singleEntryRoleIdLookup.set(sectionId, new Set());
      const singleEntryRoleIds = singleEntryRoleIdLookup.get(sectionId)!;
      for (const role of bsArrayToArray(section.element.entries)) {
        const element = role.element;
        if (element.type === 'Gap') {
          // Gaps are not supported
          continue;
        }
        if (element.type === 'Single Entry') {
          singleEntryRoleIds.add(role.id);
        }
        const roleId = role.id;
        existingSectionsNameLookup
          .get(sectionId)!
          .set(
            roleId,
            existingSectionsNameLookup.get(sectionId)!.get(roleId) || new Map(),
          );
        existingSectionsPersonIdLookup
          .get(sectionId)!
          .set(
            roleId,
            existingSectionsPersonIdLookup.get(sectionId)!.get(roleId) ||
              new Map(),
          );
        const nameLookup = existingSectionsNameLookup
          .get(sectionId)!
          .get(roleId)!;
        const personIdLookup = existingSectionsPersonIdLookup
          .get(sectionId)!
          .get(roleId)!;
        if (element.type === 'Single Entry') {
          const name = element.name.name;
          assert(name, 'Entry must have a name');
          nameLookup.set(roleId, name);
          personIdLookup.set(name, roleId);
        } else {
          for (const person of bsArrayToArray(element.names)) {
            const name = person.element?.name;
            assert(name, 'Entry must have a name');
            nameLookup.set(person.id, name);
            personIdLookup.set(name, person.id);
          }
        }
      }
    }

    trace('Updating sections');
    // Track the section IDs so we can remove any that are no longer present
    /** Map of sectionId:roleId:personId */
    const parsedIds = new Map<string, Map<string, Set<string>>>();
    for (const section of parsed.sections) {
      parsedIds.set(section.id, parsedIds.get(section.id) || new Map());
      const roleIds = parsedIds.get(section.id)!;
      updateMote(
        `data/sections/${section.id}/element/name/text`,
        section.title,
      );
      const sectionExistedAlready = existingSectionsNameLookup.get(section.id);

      for (const role of section.roles) {
        const roleExistedAlready = sectionExistedAlready?.get(role.id);

        roleIds.set(role.id, roleIds.get(role.id) || new Set());
        const personIds = roleIds.get(role.id)!;

        // If this role was a single entry but is now a group,
        // then we need to do some work to convert it. (If it was a group but has a single entry just let it be.)
        const wasSingleEntry = !!singleEntryRoleIdLookup
          .get(section.id)
          ?.has(role.id);
        if (wasSingleEntry && role.names.length > 1) {
          trace(
            `Converting single entry role ${role.id} (${role.role}) to group`,
          );
          // Delete the entire role and replace it with a Group role
          updateMote(
            `data/sections/${section.id}/element/entries/${role.id}`,
            null,
          );
          updateMote(
            `data/sections/${section.id}/element/entries/${role.id}/element/type`,
            'Group',
          );
          // Add each name to the names field
          for (const person of role.names) {
            // Will need a new ID for each person
            const personId = createBsArrayKey();
            person.id = personId;
            personIds.add(personId);
            updateMote(
              `data/sections/${section.id}/element/entries/${role.id}/element/names/${personId}/element/name`,
              person.name,
            );
            // Ensure CJK is set
            updateMote(
              `data/sections/${section.id}/element/entries/${role.id}/element/names/${personId}/element/use_cjk`,
              person.cjk,
            );
          }
        } else if (
          wasSingleEntry ||
          (role.names.length === 1 && !roleExistedAlready)
        ) {
          trace(`Updating single-entry role ${role.id} (${role.role})`);
          // Then WAS a single entry OR the role didn't exist
          // but is being added as a single entry. So keep it
          // single-entry!
          personIds.add(role.id);
          role.names[0].id = role.id;
          updateMote(
            `data/sections/${section.id}/element/entries/${role.id}/element/type`,
            'Single Entry',
          );
          // Add the name to the name field
          updateMote(
            `data/sections/${section.id}/element/entries/${role.id}/element/name/name`,
            role.names[0].name,
          );
          // Ensure CJK is set
          updateMote(
            `data/sections/${section.id}/element/entries/${role.id}/element/name/use_cjk`,
            role.names[0].cjk,
          );
        } else {
          trace(`Updating group role ${role.id} (${role.role})`);
          // Group entry! Either we're adding a new group or
          // updating an existing one, but we do the same thing
          // either way.
          updateMote(
            `data/sections/${section.id}/element/entries/${role.id}/element/type`,
            'Group',
          );
          // Add each name to the names field
          for (const person of role.names) {
            // See if we already have an id matching this name
            const personId =
              existingSectionsPersonIdLookup
                .get(section.id)
                ?.get(role.id)
                ?.get(person.name) || createBsArrayKey();
            personIds.add(personId);
            person.id = personId;
            updateMote(
              `data/sections/${section.id}/element/entries/${role.id}/element/names/${personId}/element/name`,
              person.name,
            );
            // Ensure CJK is set
            updateMote(
              `data/sections/${section.id}/element/entries/${role.id}/element/names/${personId}/element/use_cjk`,
              person.cjk,
            );
          }
        }

        // Upsert the role name. If it's one of a few special roles
        // that indicate NO role, then we want to ensure it's not set
        // instead. (Do this after the prior logic in case we first converted a single-entry group, otherwise we'd lose the change)
        const isUntitledRole =
          !role.role || role.role.match(/^(\?\?\?|none|na|undefined)$/i);
        trace(`Updating role name ${role.id} with text "${role.role}"`);
        updateMote(
          `data/sections/${section.id}/element/entries/${role.id}/element/role/text`,
          isUntitledRole ? null : role.role,
        );
      }
    }
    // Remove any content that is no longer present
    for (const [
      sectionId,
      existingRoles,
    ] of existingSectionsNameLookup.entries()) {
      const parsedRoles = parsedIds.get(sectionId);
      if (!parsedRoles) {
        updateMote(`data/sections/${sectionId}`, null);
      } else {
        // Delete any leftover roles
        for (const [
          existingRoleId,
          existingPeople,
        ] of existingRoles.entries()) {
          if (!parsedRoles.has(existingRoleId)) {
            updateMote(
              `data/sections/${sectionId}/element/entries/${existingRoleId}`,
              null,
            );
          } else {
            // Delete any leftover people
            for (const existingPersonId of existingPeople.keys()) {
              if (!parsedRoles.get(existingRoleId)!.has(existingPersonId)) {
                packed.updateMoteData(
                  moteId,
                  `data/sections/${sectionId}/element/entries/${existingRoleId}/element/names/${existingPersonId}`,
                  null,
                );
              }
            }
          }
        }
      }
    }
    // Fix the sort order of sections, roles, and people
    const orderedSections = parsed.sections.map((s) => {
      assert(s.id, `Section ID required`);
      let section = moteBase?.data.sections?.[s.id];
      if (!section) {
        section = moteWorking.data.sections?.[s.id];
        assert(section, `Section ${s.id} not found in base or working mote`);
        // @ts-expect-error - order is a required field, but it'll be re-added
        delete section.order;
      }
      const orderedRoles = s.roles.map((r) => {
        assert(r.id, `Role ID required`);
        let role = section.element?.entries?.[r.id];
        if (!role) {
          role = moteWorking.data.sections?.[s.id!]?.element?.entries?.[r.id!]!;
          assert(role, `Role ${r.id} not found in section ${s.id}`);
          // @ts-expect-error - order is a required field, but it'll be re-added
          delete role.order;
        }
        // Update the order of the people if it's a group
        if (r.names.length > 1) {
          const orderedPeople = r.names.map((p) => {
            assert(p.name, `Person name required`);
            assert(p.id, `Person ID required`);
            // Get the ID we found/set earlier
            // @ts-expect-error - Should be a group type by this point, but could be single entry in the base data
            let person = role.element?.names?.[p.id];
            if (!person) {
              const workingRole =
                moteWorking.data.sections?.[s.id!]?.element?.entries?.[r.id!]
                  ?.element;
              assert(
                workingRole?.type === 'Group',
                'Base data element must be a group',
              );
              person = workingRole.names?.[p.id];
              assert(person, `Person ${p.name} not found in section ${s.id}`);
              delete person.order;
            }
            return { ...person, id: p.id };
          });
          updateBsArrayOrder(orderedPeople);
          return { ...role, people: orderedPeople, id: r.id };
        }
        return { ...role, people: [], id: r.id };
      });
      updateBsArrayOrder(orderedRoles);

      return { ...section, roles: orderedRoles, id: s.id };
    });
    updateBsArrayOrder(orderedSections);
    // Turn those updates into actual changes
    for (const section of orderedSections) {
      trace(`Updating section ${section.id}`);
      updateMote(`data/sections/${section.id}/order`, section.order);
      for (const role of section.roles) {
        updateMote(
          `data/sections/${section.id}/element/entries/${role.id}/order`,
          role.order,
        );
        for (const person of role.people) {
          updateMote(
            `data/sections/${section.id}/element/entries/${role.id}/element/names/${person.id}/order`,
            person.order,
          );
        }
      }
    }
    trace(`Writing changes`);
    await packed.writeChanges();
  } catch (err) {
    console.error(err);
    console.error(_traceLogs);
    if (err instanceof Error) {
      err.cause = _traceLogs;
    }
    throw err;
  }
}
