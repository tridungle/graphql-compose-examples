/* eslint-disable no-use-before-define */

import {
  GraphQLInputObjectType,
  GraphQLObjectType,
  isInputType,
  isAbstractType,
  GraphQLList,
  GraphQLNonNull,
} from 'graphql';
import TypeComposer from './typeComposer';
import GenericType from './type/generic';
import { upperFirst } from './utils/misc';
import type {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLType,
  InputObjectFieldConfig,
} from './definition.js';

export function removeWrongFields(fields: GraphQLFieldConfigMap): GraphQLFieldConfigMap {
  const result = {};
  Object.keys(fields).forEach((key) => {
    const field = fields[key];
    if (
      !isAbstractType(field.type) // skip interface fields
      && !field._gqcResolver // skip fields that obtained via Resolver
    ) {
      result[key] = field;
    }
  });
  return result;
}

export type toInputObjectTypeOpts = {
  prefix?: string,
  postfix?: string,
}

export function toInputObjectType(
  graphQLType: GraphQLObjectType,
  opts: toInputObjectTypeOpts = {}
): GraphQLInputObjectType {
  const prefix: string = opts.prefix || '';
  const postfix: string = opts.postfix || 'Input';

  const name = `${prefix}${graphQLType.name}${postfix}`;

  const inputTypeComposer = new TypeComposer(
    new GraphQLInputObjectType({
      name,
      fields: {},
    })
  );

  const outputTypeComposer = new TypeComposer(graphQLType);
  const outputFields = removeWrongFields(outputTypeComposer.getFields());
  const inputFields = {};
  Object.keys(outputFields).forEach((key) => {
    const fieldOpts = {
      ...opts,
      fieldName: key,
      outputTypeName: graphQLType.name,
    };
    inputFields[key] = convertInputObjectField(outputFields[key], fieldOpts);
  });
  inputTypeComposer.addFields(inputFields);

  return inputTypeComposer.getType();
}


export type convertInputObjectFieldOpts = {
  prefix?: string,
  postfix?: string,
  fieldName?: string,
  outputTypeName?: string,
}

export function convertInputObjectField(
  field: GraphQLFieldConfig,
  opts: convertInputObjectFieldOpts
): InputObjectFieldConfig {
  let fieldType: GraphQLType = field.type;

  const wrappers = [];
  while (fieldType instanceof GraphQLList ||
         fieldType instanceof GraphQLNonNull
  ) {
    wrappers.unshift(fieldType.constructor);
    fieldType = fieldType.ofType;
  }

  if (!isInputType(fieldType)) {
    if (fieldType instanceof GraphQLObjectType) {
      const typeOpts = {
        prefix: opts.prefix,
        postfix: `${upperFirst(opts.fieldName)}${opts.postfix || ''}`,
      };
      fieldType = toInputObjectType(fieldType, typeOpts);
    } else {
      console.log( // eslint-disable-line
        `GQC: can not convert field '${opts.outputTypeName}.${opts.fieldName}' to InputType`
      );
      fieldType = GenericType;
    }
  }

  fieldType = wrappers.reduce((type, Wrapper) => new Wrapper(type), fieldType);

  return { type: fieldType, description: field.description };
}