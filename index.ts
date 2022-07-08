
import { Application, Router } from "https://deno.land/x/oak@v10.6.0/mod.ts";
import { applyGraphQL, gql, GQLError, PubSub } from "./oak-graphql-master/mod.ts";
import { serve } from "https://deno.land/std@0.147.0/http/server.ts";
import { acceptWebSocket } from "https://deno.land/std@0.92.0/ws/mod.ts";


// const app = new Application();

const pubsub = new PubSub();  

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

const conn = Deno.listen({ port: 8000 });
const httpConn = Deno.serveHttp(await conn.accept());
const e = await httpConn.nextRequest();
if (e) {
  console.log('here');
  console.log(e.request.headers.get('upgrade'));
  const { socket, response } = Deno.upgradeWebSocket(e.request);
  socket.onopen = () => {
    socket.send("Hello World!");
  };
  socket.onmessage = (e) => {
    console.log(e.data);
    socket.close();
  };
  socket.onclose = () => console.log("WebSocket has been closed.");
  socket.onerror = (e) => console.error("WebSocket error:", e);
  e.respondWith(response);
}

// app.use(GraphQLService.routes(), GraphQLService.allowedMethods());

console.log('here');
let i = 0;
const addUser = () => {
  const user = {
    firstName: 'david' + i,
    lastName: 'palmer'
  }
  i++;
  console.log(user);
  pubsub.publish('USER_ADDED', { userAdded: user });
  setTimeout(addUser, 4000);
}

addUser();

console.log("Server start at http://localhost:8080");
// await app.listen({ port: 8080 });

