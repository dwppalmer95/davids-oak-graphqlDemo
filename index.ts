
import { Application, Router } from "https://deno.land/x/oak@v10.6.0/mod.ts";
import { applyGraphQL, gql, GQLError, PubSub } from "./oak-graphql-master/mod.ts";
import { serve } from "https://deno.land/std@0.147.0/http/server.ts";
import { acceptWebSocket } from "https://deno.land/std@0.92.0/ws/mod.ts";


const types = gql`
type User {
  firstName: String
  lastName: String
}

input UserInput {
  firstName: String
  lastName: String
}

type ResolveType {
  done: Boolean
}

type Query {
  getUser(id: String): User 
}

type Mutation {
  setUser(input: UserInput!): ResolveType!
}

type Subscription {
  userAdded: User
}
`;

const USER_ADDED = 'USER_ADDED';
const pubsub = new PubSub();  

const resolvers = {
  Subscription: {
    userAdded: {
      subscribe: () => pubsub.asyncIterator([USER_ADDED]),
    }
  },
  Query: {
    getUser: (parent: any, { id }: any, context: any, info: any) => {
      console.log("id", id, context);
      if(context.user === "Aaron") {
        throw new GQLError({ type: "auth error in context" })
      }
      return {
        firstName: "david",
        lastName: "palmer",
      };
    },
  },
  Mutation: {
    setUser: (parent: any, { input: { firstName, lastName } }: any, context: any, info: any) => {
      console.log("input:", firstName, lastName);
      return {
        done: true,
      };
    },
  },
};

const GraphQLService = await applyGraphQL<Router>({
  Router,
  typeDefs: types,
  resolvers: resolvers,
  context: (ctx) => {
  	// this line is for passing a user context for the auth
    return { user: "David" };
  }
});

const app = new Application();
const router = new Router();

router.get('/graphql', ((ctx, next) => {
  console.log('here');

  console.log(ctx.request.headers);
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
  socket.addEventListener('message', (event) => {
    console.log('Web socket message', event.data);
  });
  return next();
}));

app.use(router.routes());
app.use(GraphQLService.routes(), GraphQLService.allowedMethods());
app.addEventListener('error', (ev) => {
  console.log('An error occured: ', ev);
});

// let i = 0;
// const addUser = () => {
//   const user = {
//     firstName: 'david' + i,
//     lastName: 'palmer'
//   }
//   i++;
//   console.log(user);
//   pubsub.publish('USER_ADDED', { userAdded: user });
//   setTimeout(addUser, 4000);
// }

// addUser();

console.log("Server start at http://localhost:8080");
await app.listen({ port: 8080 });

