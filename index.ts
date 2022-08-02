// denon run --allow-net index.ts

import { Application, Router } from "https://deno.land/x/oak@v10.6.0/mod.ts";
import { applyGraphQL, gql, GQLError, PubSub } from "./oak-graphql-master/mod.ts";
import { graphql, GraphQLObjectType, GraphQLString, GraphQLBoolean, subscribe, GraphQLSchema } from "https://cdn.skypack.dev/graphql";

const USER_ADDED = 'USER_ADDED';
const pubsub = new PubSub();  

const UserType = new GraphQLObjectType({
  name: 'User',
  fields: {
    firstName: { type: GraphQLString },
    lastName: { type: GraphQLString },
  },
});

const ResolveType = new GraphQLObjectType({
  name: 'Resolve',
  fields: {
    done: { type: GraphQLBoolean },
  },
});

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    getUser: { 
      type: UserType,
      resolve: () => (
        { firstName: 'David', lastName: 'Palmer' }
      )
    },
  },
});

const MutationType = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    setUser: {
      type: ResolveType,
      args: { newUser: { type: UserType } },
      resolve: (obj: any, args: any) => {
        console.log(args.newUser);
        return { done: true };
      },
    },
  },
});

const SubscriptionType = new GraphQLObjectType({
  name: 'Subscription',
  fields: {
    userAdded: {
      type: UserType,
      resolve: () => {
        console.log('inside of subscription resolver');
        pubsub.asyncIterator([USER_ADDED]);
      },
    },
  },
});

const schema = new GraphQLSchema({
  // query: QueryType,
  // mutation: MutationType,
  subscription: SubscriptionType,
});

const app = new Application();
const router = new Router();

const handleGraphQlQuery = async (ctx: any, next: any) => {
  const {query} = await ctx.request.body().value;
  console.log('Query: ', query);
  const result = await (graphql as any)({
    schema,
    document: query,
  });
  console.log('result: ', result);
  return next();
}

router.post('/graphql', handleGraphQlQuery) //remember - graphql queries over http need to be post requests

router.get('/graphql', ((ctx, next) => { //right now, a get request to /graphql starts the websocket server
  if (!ctx.isUpgradable) {
    console.log('connection not upgradeable');
    return next();
  }
  const socket = ctx.upgrade();
  socket.addEventListener('open', () => {
    console.log('Web socket open')
  });
  socket.addEventListener('close', () => {
    console.log('Web socket closed');
  });
  socket.addEventListener('message', async (event) => {
    console.log('Web socket message:', event.data);
    const result = await (subscribe as any)({
      schema,
      document: event.data,
    });
    console.log('result', result);
    addUser(5);
  });
  return next();
}));

app.use(router.routes());
// app.use(GraphQLService.routes(), GraphQLService.allowedMethods());
app.addEventListener('error', (ev) => {
  console.log('An error occured: ', ev);
});

let i = 0;
const addUser = (callNumber: number) => {
  const user = {
    firstName: 'david' + i,
    lastName: 'palmer'
  }
  i++;
  console.log(user);
  pubsub.publish('USER_ADDED', { userAdded: user });
  if (i < callNumber) setTimeout(addUser, 4000, callNumber);
}

console.log("Server start at http://localhost:8080");
await app.listen({ port: 8080 });

